/**
 * src/services/api.ts
 * ==================
 * Camada de acesso à API do Desperdício Zero.
 * Centraliza todas as chamadas HTTP (Axios) para que os hooks e screens
 * não precisem conhecer URLs ou detalhes de serialização.
 *
 * Troque BASE_URL pela URL do seu servidor (ex: IP local para Expo físico).
 */

import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Tipos espelhados do backend (schemas Pydantic)
// ---------------------------------------------------------------------------
export type UrgencyStatus = 'Verde' | 'Amarelo' | 'Vermelho';

export interface Category {
  id: number;
  name: string;
  avg_days: number;
}

export interface PantryItem {
  id: number;
  name: string;
  category_id: number;
  category: Category;
  expiry_date: string;        // ISO 8601: "YYYY-MM-DD"
  quantity: number;
  unit: string;
  expiry_estimated: boolean;
  notes: string | null;
  days_until_expiry: number;
  status_urgencia: UrgencyStatus;
}

export interface PantryItemCreate {
  name: string;
  category_id: number;
  expiry_date?: string | null;   // Opcional — ETL estima se omitido
  quantity?: number;
  unit?: string;
  notes?: string | null;
}

export interface PantryItemUpdate {
  name?: string;
  category_id?: number;
  expiry_date?: string | null;
  quantity?: number;
  unit?: string;
  notes?: string | null;
}

export interface RecipeResponse {
  recipe: string;
  products_used: string[];
}

// ---------------------------------------------------------------------------
// Histórico & Estatísticas
// ---------------------------------------------------------------------------
export type RemovalReason = 'consumed' | 'expired' | 'donated' | 'other';

export interface ItemHistoryCreate {
  item_name:      string;
  category_name:  string;
  quantity:       number;
  unit:           string;
  expiry_date:    string;   // "YYYY-MM-DD"
  removal_reason: RemovalReason;
  notes?:         string | null;
}

export interface ItemHistoryOut {
  id:             number;
  item_name:      string;
  category_name:  string;
  quantity:       number;
  unit:           string;
  expiry_date:    string;
  removal_reason: RemovalReason;
  removed_at:     string;
  notes:          string | null;
}

export interface CategoryWaste {
  category_name: string;
  total_expired: number;
}

export interface StatsResponse {
  total_removed:         number;
  total_consumed:        number;
  total_expired:         number;
  waste_rate_percent:    number;
  this_month_consumed:   number;
  this_month_expired:    number;
  top_wasted_categories: CategoryWaste[];
}

// ---------------------------------------------------------------------------
// Instância Axios
// ---------------------------------------------------------------------------
function resolveBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as typeof Constants & { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } }).manifest2?.extra?.expoClient?.hostUri;

  const host = hostUri?.split(':')[0];
  if (host) {
    return `http://${host}:8000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://127.0.0.1:8000';
}

const BASE_URL = resolveBaseUrl();
const MOCK_FLAG = process.env.EXPO_PUBLIC_USE_MOCK_API?.trim().toLowerCase();
const USE_MOCK_API = MOCK_FLAG === 'true' || MOCK_FLAG === '1' || (!process.env.EXPO_PUBLIC_API_URL && MOCK_FLAG !== 'false');

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor global de erros (log + re-throw para os hooks tratarem)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!USE_MOCK_API) {
    console.error('[API Error]', error?.response?.data ?? error.message, '| baseURL:', BASE_URL);
    }
    return Promise.reject(error);
  }
);

const mockCategories: Category[] = [
  { id: 1, name: 'Frutas', avg_days: 5 },
  { id: 2, name: 'Verduras', avg_days: 4 },
  { id: 3, name: 'Laticínios', avg_days: 7 },
  { id: 4, name: 'Carnes', avg_days: 3 },
  { id: 5, name: 'Grãos', avg_days: 30 },
];

interface MockInventoryItem {
  id: number;
  name: string;
  category_id: number;
  expiry_date: string;
  quantity: number;
  unit: string;
  expiry_estimated: boolean;
  notes: string | null;
}

let nextInventoryId = 1;
let nextHistoryId = 1;
const mockInventory: MockInventoryItem[] = [];
const mockHistory: ItemHistoryOut[] = [];

function todayAtMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysUntil(dateIso: string): number {
  const [year, month, day] = dateIso.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const diff = target.getTime() - todayAtMidnight().getTime();
  return Math.floor(diff / DAY_MS);
}

function getUrgency(days: number): UrgencyStatus {
  if (days <= 2) return 'Vermelho';
  if (days <= 5) return 'Amarelo';
  return 'Verde';
}

function categoryOrThrow(categoryId: number): Category {
  const category = mockCategories.find((cat) => cat.id === categoryId);
  if (!category) {
    throw new Error('Categoria inválida.');
  }
  return category;
}

function toPantryItem(item: MockInventoryItem): PantryItem {
  const category = categoryOrThrow(item.category_id);
  const days = daysUntil(item.expiry_date);

  return {
    id: item.id,
    name: item.name,
    category_id: item.category_id,
    category,
    expiry_date: item.expiry_date,
    quantity: item.quantity,
    unit: item.unit,
    expiry_estimated: item.expiry_estimated,
    notes: item.notes,
    days_until_expiry: days,
    status_urgencia: getUrgency(days),
  };
}

function urgencyRank(status: UrgencyStatus): number {
  if (status === 'Vermelho') return 0;
  if (status === 'Amarelo') return 1;
  return 2;
}

function sortByUrgency(items: PantryItem[]): PantryItem[] {
  return [...items].sort((left, right) => {
    const urgencyDiff = urgencyRank(left.status_urgencia) - urgencyRank(right.status_urgencia);
    if (urgencyDiff !== 0) return urgencyDiff;
    return left.days_until_expiry - right.days_until_expiry;
  });
}

if (USE_MOCK_API) {
  console.info('[API] Modo mock ativo (sem backend). Defina EXPO_PUBLIC_API_URL para usar API real.');
}

// ---------------------------------------------------------------------------
// Funções de acesso — Inventário
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Funções de acesso — Categorias
// ---------------------------------------------------------------------------

/** Retorna todas as categorias disponíveis, ordenadas por nome. */
export const fetchCategories = async (): Promise<Category[]> => {
  if (USE_MOCK_API) {
    return [...mockCategories].sort((left, right) => left.name.localeCompare(right.name));
  }

  const { data } = await apiClient.get<Category[]>('/categories/');
  return data;
};

// ---------------------------------------------------------------------------
// Funções de acesso — Inventário
// ---------------------------------------------------------------------------

/** Retorna todos os itens, já ordenados por urgência (Vermelho → Verde). */
export const fetchInventory = async (): Promise<PantryItem[]> => {
  if (USE_MOCK_API) {
    return sortByUrgency(mockInventory.map(toPantryItem));
  }

  const { data } = await apiClient.get<PantryItem[]>('/inventory/');
  return data;
};

/** Busca um único item pelo ID. */
export const fetchItemById = async (id: number): Promise<PantryItem> => {
  if (USE_MOCK_API) {
    const item = mockInventory.find((inventoryItem) => inventoryItem.id === id);
    if (!item) throw new Error('Item não encontrado.');
    return toPantryItem(item);
  }

  const { data } = await apiClient.get<PantryItem>(`/inventory/${id}`);
  return data;
};

/** Cria um novo item. Se `expiry_date` for omitido, o backend estima. */
export const createItem = async (payload: PantryItemCreate): Promise<PantryItem> => {
  if (USE_MOCK_API) {
    const category = categoryOrThrow(payload.category_id);
    const computedExpiry = payload.expiry_date?.trim()
      ? payload.expiry_date
      : toIsoDate(new Date(Date.now() + category.avg_days * DAY_MS));

    const item: MockInventoryItem = {
      id: nextInventoryId++,
      name: payload.name.trim(),
      category_id: payload.category_id,
      expiry_date: computedExpiry,
      quantity: payload.quantity ?? 1,
      unit: payload.unit ?? 'un',
      expiry_estimated: !payload.expiry_date,
      notes: payload.notes ?? null,
    };

    mockInventory.push(item);
    return toPantryItem(item);
  }

  const { data } = await apiClient.post<PantryItem>('/inventory/', payload);
  return data;
};

/** Atualiza parcialmente um item (apenas os campos fornecidos). */
export const updateItem = async (
  id: number,
  payload: PantryItemUpdate
): Promise<PantryItem> => {
  if (USE_MOCK_API) {
    const index = mockInventory.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Item não encontrado.');

    if (payload.category_id !== undefined) {
      categoryOrThrow(payload.category_id);
    }

    const current = mockInventory[index];
    const updated: MockInventoryItem = {
      ...current,
      name: payload.name !== undefined ? payload.name : current.name,
      category_id: payload.category_id !== undefined ? payload.category_id : current.category_id,
      expiry_date: payload.expiry_date !== undefined && payload.expiry_date !== null
        ? payload.expiry_date
        : payload.expiry_date === null
          ? current.expiry_date
          : current.expiry_date,
      quantity: payload.quantity !== undefined ? payload.quantity : current.quantity,
      unit: payload.unit !== undefined ? payload.unit : current.unit,
      notes: payload.notes !== undefined ? payload.notes ?? null : current.notes,
      expiry_estimated: payload.expiry_date !== undefined && payload.expiry_date !== null ? false : current.expiry_estimated,
    };

    mockInventory[index] = updated;
    return toPantryItem(updated);
  }

  const { data } = await apiClient.patch<PantryItem>(`/inventory/${id}`, payload);
  return data;
};

/** Remove um item pelo ID. */
export const deleteItem = async (id: number): Promise<void> => {
  if (USE_MOCK_API) {
    const index = mockInventory.findIndex((item) => item.id === id);
    if (index >= 0) {
      mockInventory.splice(index, 1);
    }
    return;
  }

  await apiClient.delete(`/inventory/${id}`);
};

// ---------------------------------------------------------------------------
// Funções de acesso — Histórico & Estatísticas
// ---------------------------------------------------------------------------

/**
 * Registra a remoção de um item no histórico.
 * Deve ser chamado ANTES de chamar deleteItem.
 */
export const recordHistory = async (
  payload: ItemHistoryCreate
): Promise<ItemHistoryOut> => {
  if (USE_MOCK_API) {
    const entry: ItemHistoryOut = {
      id: nextHistoryId++,
      item_name: payload.item_name,
      category_name: payload.category_name,
      quantity: payload.quantity,
      unit: payload.unit,
      expiry_date: payload.expiry_date,
      removal_reason: payload.removal_reason,
      removed_at: new Date().toISOString(),
      notes: payload.notes ?? null,
    };
    mockHistory.push(entry);
    return entry;
  }

  const { data } = await apiClient.post<ItemHistoryOut>('/history/', payload);
  return data;
};

/** Retorna as estatísticas agregadas de desperdício. */
export const fetchStats = async (): Promise<StatsResponse> => {
  if (USE_MOCK_API) {
    const total_removed = mockHistory.length;
    const total_consumed = mockHistory.filter((item) => item.removal_reason === 'consumed').length;
    const total_expired = mockHistory.filter((item) => item.removal_reason === 'expired').length;
    const waste_rate_percent = total_removed > 0 ? Number(((total_expired / total_removed) * 100).toFixed(1)) : 0;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthEntries = mockHistory.filter((item) => {
      const removedAt = new Date(item.removed_at);
      return removedAt.getMonth() === currentMonth && removedAt.getFullYear() === currentYear;
    });

    const this_month_consumed = monthEntries.filter((item) => item.removal_reason === 'consumed').length;
    const this_month_expired = monthEntries.filter((item) => item.removal_reason === 'expired').length;

    const expiredByCategory = new Map<string, number>();
    for (const item of mockHistory) {
      if (item.removal_reason !== 'expired') continue;
      expiredByCategory.set(item.category_name, (expiredByCategory.get(item.category_name) ?? 0) + 1);
    }

    const top_wasted_categories: CategoryWaste[] = [...expiredByCategory.entries()]
      .map(([category_name, total_expired]) => ({ category_name, total_expired }))
      .sort((left, right) => right.total_expired - left.total_expired)
      .slice(0, 5);

    return {
      total_removed,
      total_consumed,
      total_expired,
      waste_rate_percent,
      this_month_consumed,
      this_month_expired,
      top_wasted_categories,
    };
  }

  const { data } = await apiClient.get<StatsResponse>('/history/stats');
  return data;
};

/** Retorna o histórico de remoções de um produto específico (busca pelo nome). */
export const fetchHistoryByItem = async (itemName: string): Promise<ItemHistoryOut[]> => {
  if (USE_MOCK_API) {
    return mockHistory
      .filter((item) => item.item_name.toLowerCase() === itemName.toLowerCase())
      .slice(-20)
      .reverse();
  }

  const { data } = await apiClient.get<ItemHistoryOut[]>('/history/', {
    params: { item_name: itemName, limit: 20 },
  });
  return data;
};

// ---------------------------------------------------------------------------
// Funções de acesso — Receitas
// ---------------------------------------------------------------------------

/**
 * Envia os produtos em zona crítica e recebe uma sugestão de receita.
 * Usa timeout estendido (45s) pois a chamada ao Gemini pode demorar mais que o padrão.
 * @param products Lista de nomes dos produtos (preferencialmente "Vermelho").
 */
export const generateRecipe = async (products: string[]): Promise<RecipeResponse> => {
  if (USE_MOCK_API) {
    const normalized = products.map((product) => product.trim()).filter(Boolean);
    const products_used = normalized.slice(0, 5);
    const recipe = products_used.length > 0
      ? `Receita rápida anti-desperdício:\n\nRefogue ${products_used.join(', ')} com alho, cebola e azeite. Ajuste sal e pimenta, adicione uma fonte de proteína e finalize com ervas frescas.`
      : 'Selecione ao menos um item para gerar uma sugestão de receita.';

    return { recipe, products_used };
  }

  const { data } = await apiClient.post<RecipeResponse>(
    '/generate-recipe/',
    { products },
    { timeout: 45_000 },
  );
  return data;
};
