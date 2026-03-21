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
