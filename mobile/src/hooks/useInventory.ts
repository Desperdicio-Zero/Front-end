/**
 * src/hooks/useInventory.ts
 * =========================
 * Hook customizado que encapsula o estado e operações do inventário.
 * Mantém as screens limpas e testáveis (Separation of Concerns).
 */

import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  PantryItem,
  PantryItemCreate,
  PantryItemUpdate,
  RemovalReason,
  createItem,
  deleteItem,
  fetchInventory,
  generateRecipe,
  recordHistory,
  updateItem,
} from '../services/api';

const isExpoGoAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';

async function scheduleInventoryNotifications(items: PantryItem[]): Promise<void> {
  if (isExpoGoAndroid) return;

  const { scheduleExpiryNotifications, schedulePerItemNotifications } = await import('../services/notifications');
  await scheduleExpiryNotifications(items);
  await schedulePerItemNotifications(items);
}

// ---------------------------------------------------------------------------
// Tipos de retorno do hook
// ---------------------------------------------------------------------------
interface UseInventoryReturn {
  /** Lista de itens ordenada por urgência */
  items: PantryItem[];
  /** Indica carregamento inicial */
  loading: boolean;
  /** Indica operação em andamento (create/update/delete) */
  saving: boolean;
  /** Mensagem de erro, se houver */
  error: string | null;
  /** Recarrega a lista do servidor */
  refresh: () => Promise<void>;
  /** Adiciona um item e recarrega a lista */
  addItem: (payload: PantryItemCreate) => Promise<PantryItem>;
  /** Edita um item e recarrega a lista */
  editItem: (id: number, payload: PantryItemUpdate) => Promise<PantryItem>;
  /** Remove um item, registra o motivo no histórico e atualiza a lista localmente */
  removeItem: (id: number, item: PantryItem, reason: RemovalReason) => Promise<void>;
  /** Gera sugestão de receita. Se `products` for omitido, usa os itens em zona vermelha. */
  getRecipe: (products?: string[]) => Promise<string>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useInventory(): UseInventoryReturn {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Carregamento inicial ---------------------------------------------------
  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchInventory();
      setItems(data);
      // Notificações são ignoradas no Expo Go Android (SDK 53+)
      scheduleInventoryNotifications(data).catch(() => {});
    } catch {
      setError('Não foi possível carregar o inventário. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // -- Adicionar item --------------------------------------------------------
  const addItem = useCallback(
    async (payload: PantryItemCreate): Promise<PantryItem> => {
      setSaving(true);
      try {
        const newItem = await createItem(payload);
        await refresh(); // Recarrega para manter a ordenação correta por urgência
        return newItem;
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  // -- Editar item -----------------------------------------------------------
  const editItem = useCallback(
    async (id: number, payload: PantryItemUpdate): Promise<PantryItem> => {
      setSaving(true);
      try {
        const updated = await updateItem(id, payload);
        await refresh();
        return updated;
      } finally {
        setSaving(false);
      }
    },
    [refresh]
  );

  // -- Remover item (optimistic update + histórico) -------------------------
  const removeItem = useCallback(
    async (id: number, item: PantryItem, reason: RemovalReason): Promise<void> => {
      // Remove localmente imediatamente para feedback instantâneo
      setItems((prev) => prev.filter((i) => i.id !== id));
      try {
        // Registra no histórico antes de deletar
        await recordHistory({
          item_name:      item.name,
          category_name:  item.category.name,
          quantity:       Number(item.quantity),
          unit:           item.unit,
          expiry_date:    item.expiry_date,
          removal_reason: reason,
          notes:          item.notes ?? undefined,
        });
        await deleteItem(id);
      } catch {
        // Reverte em caso de erro
        await refresh();
        throw new Error('Erro ao remover o item. Tente novamente.');
      }
    },
    [refresh]
  );

  // -- Gerar receita ---------------------------------------------------------
  const getRecipe = useCallback(async (products?: string[]): Promise<string> => {
    const list = products ?? items
      .filter((i) => i.status_urgencia === 'Vermelho')
      .map((i) => i.name);

    if (list.length === 0) {
      return 'Nenhum produto selecionado. Adicione itens ao estoque primeiro.';
    }

    const response = await generateRecipe(list);
    return response.recipe;
  }, [items]);

  return { items, loading, saving, error, refresh, addItem, editItem, removeItem, getRecipe };
}
