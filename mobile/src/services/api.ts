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

function isUrgencyStatus(value: unknown): value is UrgencyStatus {
  return value === 'Verde' || value === 'Amarelo' || value === 'Vermelho';
}

// ---------------------------------------------------------------------------
// Mapeamento simplificado: tags/nomes do Catálogo → category_id local da Despensa
// ---------------------------------------------------------------------------
export const KEYWORD_TO_CATEGORY: [string, number][] = [
  // 1: Hortifruti
  ['hortalica', 1], ['hortalicas', 1], ['fruta', 1], ['frutas', 1], ['legume', 1], ['legumes', 1], ['verdura', 1], ['verduras', 1], ['hortifruti', 1],
  ['vegetable', 1], ['vegetables', 1], ['fruit', 1], ['fruits', 1],
  // 2: Laticínios
  ['laticinio', 2], ['laticinios', 2], ['leite', 2], ['leites', 2], ['queijo', 2], ['queijos', 2], ['requeijao', 2], ['creme de leite', 2], ['iogurte', 2], ['iogurtes', 2], ['manteiga', 2],
  ['milk', 2], ['dairy', 2], ['dairies', 2], ['cheese', 2], ['cheeses', 2], ['yogurt', 2], ['yoghurt', 2],
  // 3: Carnes e Aves
  ['carne', 3], ['carnes', 3], ['frango', 3], ['aves', 3], ['ave', 3], ['bovino', 3], ['suino', 3], ['salsicha', 3], ['linguica', 3], ['presunto', 3],
  ['meat', 3], ['meats', 3], ['chicken', 3], ['poultry', 3], ['beef', 3], ['pork', 3],
  // 4: Peixes e Frutos do Mar
  ['peixe', 4], ['peixes', 4], ['fruto do mar', 4], ['frutos do mar', 4], ['atum', 4], ['sardinha', 4],
  ['shrimp', 4], ['fish', 4], ['fishes', 4], ['seafood', 4],
  // 5: Cereais e Grãos
  ['cereal', 5], ['cereals', 5], ['grao', 5], ['graos', 5], ['arroz', 5], ['feijao', 5], ['feijoes', 5], ['lentilha', 5], ['milho', 5], ['soja', 5],
  ['grain', 5], ['grains', 5], ['rice', 5], ['bean', 5], ['beans', 5], ['lentils', 5],
  // 6: Massas e Farináceos
  ['massa', 6], ['massas', 6], ['macarrao', 6], ['macarroes', 6], ['farinha', 6], ['fuba', 6], ['tapioca', 6],
  ['pasta', 6], ['noodles', 6], ['flour', 6],
  // 7: Enlatados
  ['conserva', 7], ['conservas', 7], ['enlatado', 7], ['enlatados', 7], ['lata', 7], ['sardinha em lata', 7],
  ['canned', 7], ['can', 7],
  // 8: Bebidas
  ['bebida', 8], ['bebidas', 8], ['suco', 8], ['sucos', 8], ['refrigerante', 8], ['agua', 8], ['cha', 8], ['cafe', 8], ['cerveja', 8], ['vinho', 8], ['liquido', 8], ['achocolatado', 8],
  ['beverage', 8], ['beverages', 8], ['drink', 8], ['drinks', 8], ['juice', 8], ['juices', 8], ['soda', 8], ['water', 8], ['tea', 8], ['coffee', 8], ['beer', 8], ['wine', 8],
  // 9: Condimentos e Temperos
  ['condimento', 9], ['condimentos', 9], ['tempero', 9], ['temperos', 9], ['molho', 9], ['molhos', 9], ['sal', 9], ['pimenta', 9], ['azeite', 9], ['oleo', 9], ['vinagre', 9],
  ['spice', 9], ['spices', 9], ['condiment', 9], ['condiments', 9], ['sauce', 9], ['sauces', 9],
  // 10: Congelados
  ['congelado', 10], ['congelados', 10], ['sorvete', 10], ['sorvetes', 10],
  ['frozen', 10], ['frozenfood', 10], ['frozenfoods', 10],
  // 11: Pães e Confeitaria
  ['pao', 11], ['paes', 11], ['bolo', 11], ['bolos', 11], ['biscoito', 11], ['biscoitos', 11], ['bolacha', 11], ['bolachas', 11], ['doce', 11], ['doces', 11], ['confeitaria', 11], ['sobremesa', 11], ['sobremesas', 11], ['chocolate', 11],
  ['bread', 11], ['breads', 11], ['cake', 11], ['cakes', 11], ['cookie', 11], ['cookies', 11], ['biscuit', 11], ['biscuits', 11],
  // 12: Ovos
  ['ovo', 12], ['ovos', 12], ['egg', 12], ['eggs', 12],
  // OpenFoodFacts tags comuns ("en:...")
  ['endairies', 2], ['endairy', 2],
  ['enmeat', 3], ['enmeats', 3],
  ['enfish', 4], ['enseafood', 4],
  ['encereals', 5], ['engrains', 5],
  ['enpasta', 6],
  ['encannedfoods', 7],
  ['enbeverages', 8],
  ['enspices', 9], ['encondiments', 9],
  ['enfrozenfoods', 10],
  ['enbreads', 11],
  ['eneggs', 12],
];

export function guessCategory(tags: string[]): number {
  const normalized = tags.map((t) =>
    t
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/g, '')
  );
  for (const [keyword, id] of KEYWORD_TO_CATEGORY) {
    const normalizedKeyword = keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]/g, '');

    if (!normalizedKeyword) continue;
    if (normalized.some((t) => t.includes(normalizedKeyword))) return id;
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
const MACHINE_IP = '192.168.18.9'; // ← ALTERE AQUI quando mudar de rede
const DAY_MS = 24 * 60 * 60 * 1000;
const USE_MOCK_API = false; // ou baseado em env: !process.env.EXPO_PUBLIC_API_URL

const ENV_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
const NORMALIZED_ENV_API_URL = ENV_API_URL ? ENV_API_URL.replace(/\/$/, '') : '';

export const BASE_URL = NORMALIZED_ENV_API_URL
  ? NORMALIZED_ENV_API_URL
  : Platform.OS === 'web'
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

function extractIsoDateOnly(value: string): string {
  // Normaliza formatos comuns:
  // - "YYYY-MM-DD" -> mantém
  // - "YYYY-MM-DDTHH:mm:ss.sssZ" -> extrai "YYYY-MM-DD"
  // - "YYYY-MM-DD HH:mm:ss" -> extrai "YYYY-MM-DD"
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? value;
}

function daysUntil(dateIso: string): number {
  const dateOnly = extractIsoDateOnly(String(dateIso ?? '')).trim();
  const parts = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) {
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const day = Number(parts[3]);
    const target = new Date(year, month - 1, day);
    const diff = target.getTime() - todayAtMidnight().getTime();
    return Math.floor(diff / DAY_MS);
  }

  // Fallback: tenta parsear como Date (se vier em outro formato)
  const parsed = new Date(dateIso);
  if (!Number.isNaN(parsed.getTime())) {
    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const diff = target.getTime() - todayAtMidnight().getTime();
    return Math.floor(diff / DAY_MS);
  }

  return 0;
}

function getUrgency(days: number): UrgencyStatus {
  if (days <= 2) return 'Vermelho';
  if (days <= 5) return 'Amarelo';
  return 'Verde';
}

function normalizePantryItemFromApi(input: any): PantryItem {
  const rawExpiry = String(input?.expiry_date ?? '');
  const expiryDate = rawExpiry ? extractIsoDateOnly(rawExpiry) : '';
  const computedDays = expiryDate ? daysUntil(expiryDate) : 0;
  const days = typeof input?.days_until_expiry === 'number' ? input.days_until_expiry : computedDays;
  const status = isUrgencyStatus(input?.status_urgencia)
    ? input.status_urgencia
    : getUrgency(days);

  return {
    id: Number(input.id),
    name: String(input.name ?? ''),
    category_id: Number(input.category_id),
    category: input.category as Category,
    expiry_date: expiryDate,
    quantity: Number(input.quantity ?? 1),
    unit: String(input.unit ?? 'un'),
    expiry_estimated: input.expiry_estimated === true || input.expiry_estimated === 1 || input.expiry_estimated === 'true',
    notes: (input.notes ?? null) as string | null,
    days_until_expiry: days,
    status_urgencia: status,
  };
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

// ---------------------------------------------------------------------------
// Tipos e Funções — Perfil do Usuário
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: number;
  email: string;
  createdAt: string;
}

export interface UpdateProfilePayload {
  currentPassword: string;
  newEmail?: string;
  newPassword?: string;
}

/** Retorna o perfil do usuário autenticado. */
export const getProfile = async (): Promise<UserProfile> => {
  const { data } = await apiClient.get<UserProfile>('/auth/me');
  return data;
};

/** Atualiza e-mail e/ou senha do usuário. Requer a senha atual. */
export const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
  const { data } = await apiClient.put<UserProfile>('/auth/me', payload);
  return data;
};

// ---------------------------------------------------------------------------
// Funções de acesso — Inventário real

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

  const { data } = await apiClient.get<any>(`/inventory/${id}`);
  return normalizePantryItemFromApi(data);
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

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface HealthResponse {
  status: 'ok' | string;
  timestamp: string;
}

/** Ping simples para validar se o backend está online e a BASE_URL está correta. */
export const healthCheck = async (): Promise<HealthResponse> => {
  if (USE_MOCK_API) {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  const { data } = await apiClient.get<HealthResponse>('/health', { timeout: 3_000 });
  return data;
};

// Auth Methods
export const login = async (email: string, password: string): Promise<TokenResponse> => {
  // OAuth-style login: backend expects form-urlencoded (username/password)
  const body = `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

  const res = await apiClient.post('/auth/login', body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return res.data; // { access_token: string, token_type: string }
};

export const register = async (email: string, password: string): Promise<void> => {
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

/** Retorna o histórico geral (timeline) de remoções do usuário. */
export const fetchHistoryTimeline = async (limit = 20, skip = 0): Promise<ItemHistoryOut[]> => {
  if (USE_MOCK_API) {
    return [...mockHistory]
      .sort((a, b) => new Date(b.removed_at).getTime() - new Date(a.removed_at).getTime())
      .slice(skip, skip + limit);
  }

  const { data } = await apiClient.get<ItemHistoryOut[]>('/history/', {
    params: { limit, skip },
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

// ---------------------------------------------------------------------------
// Funções de acesso — Nota Fiscal (Receipt)
// ---------------------------------------------------------------------------

export interface ParsedReceiptItem {
  name: string;
  quantity: number;
  unit: string;
  category_id: number;
  category_hint: string;
}

const CATEGORY_LABEL_BY_ID: Record<number, string> = {
  1: 'Hortifruti',
  2: 'Laticínios',
  3: 'Carnes e Aves',
  4: 'Peixes e Frutos do Mar',
  5: 'Cereais e Grãos',
  6: 'Massas e Farináceos',
  7: 'Enlatados',
  8: 'Bebidas',
  9: 'Condimentos e Temperos',
  10: 'Congelados',
  11: 'Pães e Confeitaria',
  12: 'Ovos',
  13: 'Outros',
};

function normalizeReceiptItem(raw: any): ParsedReceiptItem {
  const name = String(raw?.name ?? '').trim() || 'Produto sem nome';
  const quantityRaw = Number(raw?.quantity ?? 1);
  const quantity = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
  const unit = String(raw?.unit ?? 'unidade').trim() || 'unidade';

  const candidateId = Number(raw?.category_id ?? raw?.categoryId);
  const fallbackCategoryId = guessCategory([
    name,
    String(raw?.suggested_category ?? ''),
    String(raw?.category_hint ?? ''),
    unit,
  ]);

  const categoryId = CATEGORY_LABEL_BY_ID[candidateId] ? candidateId : fallbackCategoryId;

  return {
    name,
    quantity,
    unit,
    category_id: categoryId,
    category_hint: CATEGORY_LABEL_BY_ID[categoryId] ?? 'Outros',
  };
}

export interface ReceiptScanResponse {
  items_parsed: ParsedReceiptItem[];
  items_created: PantryItem[];
  raw_count: number;
}

/**
 * Envia a foto do cupom fiscal e recebe os produtos extraídos por IA.
 * Timeout estendido (60s) pois o Gemini Vision pode demorar.
 */
export const scanReceipt = async (imageBase64: string): Promise<ReceiptScanResponse> => {
  const { data } = await apiClient.post<any>(
    '/receipt/scan',
    { image_base64: imageBase64 },
    { timeout: 60_000 },
  );

  // Compatibilidade com backend antigo (array direto) e novo (objeto com items_parsed)
  const rawItems = Array.isArray(data)
    ? data
    : Array.isArray(data?.items_parsed)
      ? data.items_parsed
      : [];

  return {
    items_parsed: rawItems.map(normalizeReceiptItem),
    items_created: Array.isArray(data?.items_created) ? data.items_created : [],
    raw_count: Number(data?.raw_count ?? rawItems.length),
  };
};

/**
 * Importa os itens selecionados pelo usuário após a revisão do cupom.
 */
export interface ReceiptImportResponse {
  message: string;
  count: number;
}

export const importReceiptItems = async (items: ParsedReceiptItem[]): Promise<ReceiptImportResponse> => {
  const { data } = await apiClient.post<ReceiptImportResponse>(
    '/receipt/import',
    { items },
    { timeout: 30_000 },
  );
  return data;
};

// ---------------------------------------------------------------------------
// Funções de acesso — Doação Reversa
// ---------------------------------------------------------------------------

export interface DonationEligibility {
  eligible: boolean;
  reason: string | null;
}

export interface DonationPlace {
  name: string;
  address: string;
  phone: string | null;
  whatsapp: string | null;
  distance_km: number;
  accepts_perishable: boolean;
  hours: string;
  description: string;
}

export interface DonationSuggestResponse {
  places: DonationPlace[];
  item_name: string;
  whatsapp_message: string;
}

/** Verifica se o item é elegível para doação. */
export const checkDonationEligibility = async (itemId: number): Promise<DonationEligibility> => {
  const { data } = await apiClient.post<DonationEligibility>(
    '/donation/check',
    { item_id: itemId },
  );
  return data;
};

/** Busca ONGs/Bancos de Alimentos próximos para doação. */
export const suggestDonationPlaces = async (
  itemId: number,
  latitude: number,
  longitude: number,
  city: string = '',
): Promise<DonationSuggestResponse> => {
  const { data } = await apiClient.post<DonationSuggestResponse>(
    '/donation/suggest',
    { item_id: itemId, latitude, longitude, city },
    { timeout: 45_000 },
  );
  return data;
};
