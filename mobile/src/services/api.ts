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

// ---------------------------------------------------------------------------
// Mapeamento simplificado: tags/nomes do Catálogo → category_id local da Despensa
// ---------------------------------------------------------------------------
export const KEYWORD_TO_CATEGORY: [string, number][] = [
  // 1: Hortifruti
  ['hortalica', 1], ['fruta', 1], ['legume', 1], ['verdura', 1], ['hortifruti', 1],
  // 2: Laticínios
  ['laticinio', 2], ['leite', 2], ['queijo', 2], ['requeijao', 2], ['creme de leite', 2], ['iogurte', 2], ['manteiga', 2], ['milk', 2], ['dairy', 2], ['cheese', 2], ['yogurt', 2],
  // 3: Carnes e Aves
  ['carne', 3], ['frango', 3], ['ave', 3], ['bovino', 3], ['suino', 3], ['salsicha', 3], ['linguica', 3], ['presunto', 3], ['meat', 3], ['chicken', 3], ['beef', 3], ['pork', 3],
  // 4: Peixes e Frutos do Mar
  ['peixe', 4], ['fruto do mar', 4], ['atum', 4], ['sardinha', 4], ['shrimp', 4], ['fish', 4], ['seafood', 4],
  // 5: Cereais e Grãos
  ['cereal', 5], ['grao', 5], ['arroz', 5], ['feijao', 5], ['lentilha', 5], ['milho', 5], ['soja', 5], ['grain', 5], ['rice', 5], ['bean', 5],
  // 6: Massas e Farináceos
  ['massa', 6], ['macarrao', 6], ['farinha', 6], ['fuba', 6], ['tapioca', 6], ['pasta', 6], ['flour', 6],
  // 7: Enlatados
  ['conserva', 7], ['enlatado', 7], ['lata', 7], ['sardinha em lata', 7], ['canned', 7],
  // 8: Bebidas
  ['bebida', 8], ['suco', 8], ['refrigerante', 8], ['agua', 8], ['cha', 8], ['cafe', 8], ['cerveja', 8], ['vinho', 8], ['liquido', 8], ['achocolatado', 8], ['beverage', 8], ['drink', 8], ['juice', 8], ['soda', 8],
  // 9: Condimentos e Temperos
  ['condimento', 9], ['tempero', 9], ['molho', 9], ['sal', 9], ['pimenta', 9], ['azeite', 9], ['oleo', 9], ['vinagre', 9], ['spice', 9], ['condiment', 9], ['sauce', 9],
  // 10: Congelados
  ['congelado', 10], ['sorvete', 10], ['frozen', 10],
  // 11: Pães e Confeitaria
  ['pao', 11], ['bolo', 11], ['biscoito', 11], ['bolacha', 11], ['doce', 11], ['confeitaria', 11], ['sobremesa', 11], ['chocolate', 11], ['bread', 11], ['cake', 11],
  // 12: Ovos
  ['ovo', 12], ['egg', 12],
];

export function guessCategory(tags: string[]): number {
  const normalized = tags.map((t) =>
    t.toLowerCase().replace(/[^a-z0-9]/g, '')
  );
  for (const [keyword, id] of KEYWORD_TO_CATEGORY) {
    if (normalized.some((t) => t.includes(keyword))) return id;
  }
  return 13; // Outros
}

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
// Modelos de Catálogo Global Mestre
// ---------------------------------------------------------------------------
export interface CatalogBrandOut {
  id: number;
  name: string;
}

export interface CatalogCategoryOut {
  id: number;
  name: string;
}

export interface CatalogProductOut {
  ean: string;
  name: string;
  quantity_normalized: number | null;
  brand: CatalogBrandOut;
  category: CatalogCategoryOut;
  energy_kcal_100g: number;
  fat_100g: number;
  carbohydrates_100g: number;
  sugars_100g: number;
  proteins_100g: number;
  nutriscore_grade: string | null;
  nova_group: number | null;
}

// ---------------------------------------------------------------------------
// Histórico & Estatísticas
// ---------------------------------------------------------------------------
export type RemovalReason = 'consumed' | 'expired' | 'donated' | 'other';

export interface ItemHistoryCreate {
  item_name: string;
  category_name: string;
  quantity: number;
  unit: string;
  expiry_date: string;   // "YYYY-MM-DD"
  removal_reason: RemovalReason;
  notes?: string | null;
}

export interface ItemHistoryOut {
  id: number;
  item_name: string;
  category_name: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  removal_reason: RemovalReason;
  removed_at: string;
  notes: string | null;
}

export interface CategoryWaste {
  category_name: string;
  total_expired: number;
}

export interface StatsResponse {
  total_removed: number;
  total_consumed: number;
  total_expired: number;
  waste_rate_percent: number;
  this_month_consumed: number;
  this_month_expired: number;
  top_wasted_categories: CategoryWaste[];
}

// ---------------------------------------------------------------------------
// Instância Axios
// ---------------------------------------------------------------------------
// Detecta automaticamente se está rodando no browser (web) ou no celular.
// - Web:    usa localhost (backend e browser na mesma máquina)
// - Mobile: usa o IP de rede local (celular acessa a máquina via Wi-Fi)
import { Platform } from 'react-native';
// ⚠️  TROQUE o IP abaixo pelo IP da sua máquina na rede atual.
//    Para ver seu IP: abra o PowerShell e rode → ipconfig | findstr "IPv4"
const MACHINE_IP = '192.168.15.6'; // ← ALTERE AQUI quando mudar de rede

export const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : `http://${MACHINE_IP}:8000`;

export const apiClient = axios.create({
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
// Funções de acesso — Catálogo Global (Autocomplete e Scanner)
// ---------------------------------------------------------------------------

/**
 * Busca parcial pelo nome do produto na base global (Typeahead/Autocomplete).
 */
export const searchCatalog = async (query: string): Promise<CatalogProductOut[]> => {
  const { data } = await apiClient.get<CatalogProductOut[]>('/catalog/search', {
    params: { q: query, limit: 10 }
  });
  return data;
};

/**
 * Busca exata do Scanner pela chave primária (Código de barras).
 */
export const getCatalogItemByEan = async (ean: string): Promise<CatalogProductOut> => {
  const { data } = await apiClient.get<CatalogProductOut>(`/catalog/${ean}`);
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

// Auth Methods
export const login = async (email: string, password: string) => {
  // fastapi OAuth2PasswordRequestForm expects form-urlencoded
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const res = await apiClient.post('/auth/login', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return res.data; // { access_token: string, token_type: string }
};

export const register = async (email: string, password: string) => {
  const { data } = await apiClient.post('/auth/register', {
    email,
    password,
  });
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
