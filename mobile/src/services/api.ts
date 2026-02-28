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
// IP local da máquina de desenvolvimento (mesmo IP exibido pelo Expo no QR Code).
// Troque se o seu IP mudar (rode `ipconfig` no Windows para verificar).
const BASE_URL = 'http://172.20.10.2:8000';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor global de erros (log + re-throw para os hooks tratarem)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error?.response?.data ?? error.message);
    return Promise.reject(error);
  }
);

// ---------------------------------------------------------------------------
// Funções de acesso — Inventário
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Funções de acesso — Categorias
// ---------------------------------------------------------------------------

/** Retorna todas as categorias disponíveis, ordenadas por nome. */
export const fetchCategories = async (): Promise<Category[]> => {
  const { data } = await apiClient.get<Category[]>('/categories/');
  return data;
};

// ---------------------------------------------------------------------------
// Funções de acesso — Inventário
// ---------------------------------------------------------------------------

/** Retorna todos os itens, já ordenados por urgência (Vermelho → Verde). */
export const fetchInventory = async (): Promise<PantryItem[]> => {
  const { data } = await apiClient.get<PantryItem[]>('/inventory/');
  return data;
};

/** Busca um único item pelo ID. */
export const fetchItemById = async (id: number): Promise<PantryItem> => {
  const { data } = await apiClient.get<PantryItem>(`/inventory/${id}`);
  return data;
};

/** Cria um novo item. Se `expiry_date` for omitido, o backend estima. */
export const createItem = async (payload: PantryItemCreate): Promise<PantryItem> => {
  const { data } = await apiClient.post<PantryItem>('/inventory/', payload);
  return data;
};

/** Atualiza parcialmente um item (apenas os campos fornecidos). */
export const updateItem = async (
  id: number,
  payload: PantryItemUpdate
): Promise<PantryItem> => {
  const { data } = await apiClient.patch<PantryItem>(`/inventory/${id}`, payload);
  return data;
};

/** Remove um item pelo ID. */
export const deleteItem = async (id: number): Promise<void> => {
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
  const { data } = await apiClient.post<ItemHistoryOut>('/history/', payload);
  return data;
};

/** Retorna as estatísticas agregadas de desperdício. */
export const fetchStats = async (): Promise<StatsResponse> => {
  const { data } = await apiClient.get<StatsResponse>('/history/stats');
  return data;
};

/** Retorna o histórico de remoções de um produto específico (busca pelo nome). */
export const fetchHistoryByItem = async (itemName: string): Promise<ItemHistoryOut[]> => {
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
  const { data } = await apiClient.post<RecipeResponse>(
    '/generate-recipe/',
    { products },
    { timeout: 45_000 },
  );
  return data;
};
