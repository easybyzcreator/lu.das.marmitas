import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { Product, Order, Settings, Category, CartItem, Side, ProductSize, ImageGallery } from '../types';
import { Plus, Minus, ShoppingBag, X, MessageCircle, MessageSquare, Check, Calendar, Building2, User, Phone, MapPin, RefreshCw, ChevronDown, Snowflake, Flame, Utensils, Apple, Sparkles, Info, AlertCircle, CheckCircle2, Clock, Ban, HelpCircle, Leaf, Search, Zap, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getCanonicalDishKey } from '../lib/utils';
import { toast } from 'sonner';
import BRDatePicker from './BRDatePicker';
import { initialProducts, initialCategories } from '../data/defaultCatalog';

const translations = {
  pt: {
    cartTitle: 'Seu Carrinho',
    emptyCart: 'Seu carrinho está vazio',
    total: 'Total',
    next: 'Próximo: Seus Dados',
    back: 'Voltar',
    finish: 'Finalizar Pedido',
    fullName: 'Nome Completo',
    phone: 'Telefone',
    email: 'E-mail',
    birthday: 'Aniversário (Dia/Mês)',
    birthdayPlaceholder: 'DD/MM',
    street: 'Rua/Avenida',
    number: 'Nº/Apto',
    zipCode: 'CEP',
    city: 'Cidade',
    state: 'Estado',
    observation: 'Observação',
    orderDetails: 'Detalhes do seu Pedido',
    customCakeTitle: 'Opções de Personalização',
    chooseModel: 'Escolha o Modelo',
    chooseSize: 'Escolha o Tamanho',
    chooseDough: 'Escolha a Massa',
    chooseFillings: 'Escolha os Recheios',
    chooseFrosting: 'Escolha a Cobertura',
    chooseSides: 'Escolha os Acompanhamentos',
    excludeIngredients: 'Excluir Ingredientes',
    limitReached: 'Limite atingido',
    addToCart: 'Adicionar ao Carrinho',
    whatsappOrder: 'Pedido',
    whatsappData: 'Dados do Cliente',
    whatsappItems: 'Itens do Pedido',
    whatsappTotal: 'Total do Pedido',
    whatsappDate: 'Data',
    whatsappAt: 'às',
    pickupDate: 'Data de Entrega/Retirada',
    pickupDatePlaceholder: 'MM/DD/AAAA',
    consultMessage: 'Existem itens no pedido com valores a consultar. Aguarde a confirmação pelo WhatsApp.'
  },
  en: {
    cartTitle: 'Seu Carrinho',
    emptyCart: 'Seu carrinho está vazio',
    total: 'Total',
    next: 'Próximo: Seus Dados',
    back: 'Voltar',
    finish: 'Finalizar Pedido',
    fullName: 'Nome Completo',
    phone: 'Telefone',
    email: 'E-mail',
    birthday: 'Aniversário (Dia/Mês)',
    birthdayPlaceholder: 'DD/MM',
    street: 'Rua/Avenida',
    number: 'Nº/Apto',
    zipCode: 'CEP',
    city: 'Cidade',
    state: 'Estado',
    observation: 'Observação',
    orderDetails: 'Detalhes do seu Pedido',
    customCakeTitle: 'Opções de Personalização',
    chooseModel: 'Escolha o Modelo',
    chooseSize: 'Escolha o Tamanho',
    chooseDough: 'Escolha a Massa',
    chooseFillings: 'Escolha os Recheios',
    chooseFrosting: 'Escolha a Cobertura',
    chooseSides: 'Escolha os Acompanhamentos',
    excludeIngredients: 'Excluir Ingredientes',
    limitReached: 'Limite atingido',
    addToCart: 'Adicionar ao Carrinho',
    whatsappOrder: 'Pedido',
    whatsappData: 'Dados do Cliente',
    whatsappItems: 'Itens do Pedido',
    whatsappTotal: 'Total do Pedido',
    whatsappDate: 'Data',
    whatsappAt: 'às',
    pickupDate: 'Data de Entrega/Retirada',
    pickupDatePlaceholder: 'DD/MM/AAAA',
    consultMessage: 'Existem itens no pedido com valores a consultar. Aguarde a confirmação pelo WhatsApp.'
  }
};

const formatBRPhone = (value: string): string => {
  let val = value.replace(/\D/g, '');
  
  // Truncate at 11 digits to strictly respect the 11-digit Brazilian mask: (99) 99999-9999
  if (val.length > 11) {
    val = val.slice(0, 11);
  }
  
  if (val.length === 0) return '';
  if (val.length <= 2) {
    return `(${val}`;
  }
  if (val.length <= 6) {
    return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  }
  if (val.length <= 10) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  }
  return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
};

const getCleanWhatsAppPhone = (phone: string): string => {
  let clean = phone.replace(/\D/g, '');
  
  // If the numeric result does not start with '55', add '55' in front
  if (clean.length > 0 && !clean.startsWith('55')) {
    clean = '55' + clean;
  }
  
  return clean;
};

export const getContrastText = (hexColor?: string): string => {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const hsp = Math.sqrt(
    0.299 * (r * r) +
    0.587 * (g * g) +
    0.114 * (b * b)
  );
  return hsp > 155 ? '#000000' : '#ffffff';
};

export const getColorWithLegibility = (hexColor?: string, defaultColor: string = '#865d39'): string => {
  if (!hexColor) return defaultColor;
  let hex = hexColor.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  if (hex.length !== 6) return defaultColor;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (luminance > 0.6) {
    return defaultColor;
  }
  return `#${hex}`;
};

const translateSettingsToEnglish = (s: Settings): Settings => s;

export default function Menu({ settings: initialSettings }: { settings: Settings }) {
  const settings = {
    ...initialSettings,
    language: 'pt' as 'pt' | 'en',
    currency: (initialSettings?.currency || 'BRL') as 'BRL' | 'USD'
  };
  const t = translations['pt'];
  const currencySymbol = settings.currency === 'USD' ? '$ ' : 'R$ ';

  const renderTitle = (title: string) => {
    if (title && title.toLowerCase() === 'escola de gastronomia e negócios') {
      return (
        <>
          Escola de gastronomia<br />e negócios
        </>
      );
    }
    return title;
  };

  const DEFAULT_CAKE_SIZES = [
    '7" - 15 a 20 Fatias (Aprox. 1.5kg)',
    '9" - 25 a 30 Fatias (Aprox. 2.5kg)',
    '12" - 40 a 50 Fatias (Aprox. 4.0kg)'
  ];

  const DEFAULT_CAKE_DOUGHS = [
    'Massa de Baunilha',
    'Massa de Chocolate 50% Cacau',
    'Massa Red Velvet'
  ];

  const DEFAULT_CAKE_FILLINGS = [
    'Brigadeiro Gourmet (Chocolate Belga)',
    'Beijinho de Coco (Tradicional)',
    'Doce de Leite Tradicional',
    'Creme de Ninho com Frutas Vermelhas'
  ];

  const DEFAULT_CAKE_TOPPINGS = [
    'Chantininho Cremoso (Ninho)',
    'Ganache de Chocolate Belga',
    'Buttercream Clássico'
  ];

  const DEFAULT_CAKE_TOPPERS = [
    'Nenhum',
    'Feliz Aniversário',
    'Parabéns'
  ];

  const cakeSizesList = (settings.cakeSizes && settings.cakeSizes.length > 0) ? settings.cakeSizes : DEFAULT_CAKE_SIZES;
  const cakeDoughsList = (settings.cakeDoughs && settings.cakeDoughs.length > 0) ? settings.cakeDoughs : DEFAULT_CAKE_DOUGHS;
  const cakeFillingsList = (settings.cakeFillings && settings.cakeFillings.length > 0) ? settings.cakeFillings : DEFAULT_CAKE_FILLINGS;
  const cakeToppingsList = (settings.cakeToppings && settings.cakeToppings.length > 0) ? settings.cakeToppings : DEFAULT_CAKE_TOPPINGS;
  const cakeToppersList = (settings.cakeToppers && settings.cakeToppers.length > 0) ? settings.cakeToppers : DEFAULT_CAKE_TOPPERS;

  const [products, setProducts] = useState<Product[]>(() => {
    return [...initialProducts].sort((a, b) => {
      const oA = typeof a.order === 'number' ? a.order : 9999;
      const oB = typeof b.order === 'number' ? b.order : 9999;
      if (oA !== oB) return oA - oB;
      return (a.title || '').localeCompare(b.title || '');
    });
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    return [...initialCategories].sort((a, b) => {
      const oA = typeof a.order === 'number' ? a.order : 9999;
      const oB = typeof b.order === 'number' ? b.order : 9999;
      return oA - oB;
    });
  });
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sides, setSides] = useState<Side[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [selectedProductForCustom, setSelectedProductForCustom] = useState<Product | null>(null);
  const [isDietsModalOpen, setIsDietsModalOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [isDetoxModalOpen, setIsDetoxModalOpen] = useState(false);
  const [isCustomDietModalOpen, setIsCustomDietModalOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [mealSelections, setMealSelections] = useState<{
    removals: string[];
    sides: Side[];
  }>({
    removals: [],
    sides: []
  });
  const [sideQuantities, setSideQuantities] = useState<Record<string, number>>({});
  const [selectedCakeSize, setSelectedCakeSize] = useState<string>('');
  const [selectedDough, setSelectedDough] = useState<string>('');
  const [selectedFillings, setSelectedFillings] = useState<string[]>([]);
  const [selectedSandwichFillings, setSelectedSandwichFillings] = useState<string[]>([]);
  const [selectedTopping, setSelectedTopping] = useState<string>('');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]); // dummy if needed, but not used now
  const [selectedTopper, setSelectedTopper] = useState<string>('');
  const [b2bName, setB2bName] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).name || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bResponsibleName, setB2bResponsibleName] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).manager || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bPhone, setB2bPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).phone || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bAddress, setB2bAddress] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).address || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bZipCode, setB2bZipCode] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).zipCode || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bCity, setB2bCity] = useState(() => {
    try {
      const saved = localStorage.getItem('b2b_profile_save');
      return saved ? JSON.parse(saved).city || '' : '';
    } catch {
      return '';
    }
  });
  const [b2bFrequency, setB2bFrequency] = useState<'one-time' | 'weekly'>('one-time');
  const [isReturningB2b, setIsReturningB2b] = useState(() => {
    try {
      return localStorage.getItem('b2b_profile_save') ? true : false;
    } catch {
      return false;
    }
  });
  const [b2bSearchResults, setB2bSearchResults] = useState<any[]>([]);
  const [showB2bSearchDropdown, setShowB2bSearchDropdown] = useState(false);
  const [b2bProfiles, setB2bProfiles] = useState<any[]>([]);
  const [pqCoquetel, setPqCoquetel] = useState(0);
  const [pqMedio, setPqMedio] = useState(0);
  const [pqPremium, setPqPremium] = useState(0);
  const [b2bDate, setB2bDate] = useState('');
  const [b2bObservation, setB2bObservation] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<'summary' | 'form' | 'channels' | 'b2b_channels'>('summary');
  const [hasRedirected, setHasRedirected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null);
  const [b2bSuccessUrls, setB2bSuccessUrls] = useState<{ whatsapp: string } | null>(null);
  const [standardSuccessUrls, setStandardSuccessUrls] = useState<{ whatsapp: string } | null>(null);
  const [galleries, setGalleries] = useState<ImageGallery[]>([]);
  const [selectedStyleNumber, setSelectedStyleNumber] = useState<number | null>(null);
  const [customItemQuantity, setCustomItemQuantity] = useState<number>(1);
  const [sandwichFillingQuantities, setSandwichFillingQuantities] = useState<Record<string, number>>({});
  const [selectedComboProduct, setSelectedComboProduct] = useState<Product | null>(null);
  const [comboDishSelections, setComboDishSelections] = useState<Record<string, number>>({});
  const [selectedDishForNutritionalInfo, setSelectedDishForNutritionalInfo] = useState<Product | null>(null);
  const [comboSearchTerm, setComboSearchTerm] = useState<string>('');

  useEffect(() => {
    if (isCustomModalOpen || selectedProductForDetails) {
      setCustomItemQuantity(1);
      setSandwichFillingQuantities({});
    }
  }, [isCustomModalOpen, selectedProductForDetails]);

  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    endereco: '',
    street: '',
    number: '',
    zipCode: '',
    city: '',
    state: '',
    aniversario: '',
    observacao: '',
    email: '',
    deliveryOption: 'delivery' as 'delivery' | 'pickup',
    scheduledDate: '',
    scheduledTime: '',
    wantsReadyDelivery: false,
    deliveryNeighborhoodId: '',
    deliveryNeighborhoodName: '',
    deliveryFee: 0
  });

  const [activeScreen, setActiveScreen] = useState<'intro' | 'selector' | 'menu'>(() => {
    if (settings.introEnabled !== false) return 'intro';
    return 'menu';
  });
  const [selectedCatalog, setSelectedCatalog] = useState<'catalog1' | 'catalog2' | 'catalog3' | 'catalog4' | null>('catalog1');

  useEffect(() => {
    if (settings) {
      if (settings.introEnabled === false) {
        setActiveScreen('menu');
      }
    }
  }, [settings]);

  useEffect(() => {
    if (selectedCatalog !== 'catalog1') {
      setSelectedCatalog('catalog1');
    }
  }, [selectedCatalog]);

  useEffect(() => {
    if (selectedProductForDetails) {
      const product = selectedProductForDetails;
      if (product.sizes && product.sizes.length > 0) {
        setSelectedSize(product.sizes[0]);
      } else {
        setSelectedSize(null);
      }

      if (product.isCustomCake) {
        setSelectedCakeSize('');
        setSelectedDough('');
        setSelectedFillings([]);
        setSelectedTopping('');
        setSelectedTopper('');
        setSelectedStyleNumber(null);
      }

      if (product.isCustomSandwich) {
        setSelectedSandwichFillings([]);
      }

      setMealSelections({
        removals: []
      });
      setSideQuantities({});
    }
  }, [selectedProductForDetails]);

  useEffect(() => {
    console.log('Menu: Inicilizando listeners...');
    setLoading(true);
    
    const unsubProducts = onSnapshot(collection(db, 'produtos'), (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => {
        const data = doc.data() as Product;
        const matchingInitial = initialProducts.find(ip => ip.title.trim().toLowerCase() === data.title?.trim().toLowerCase() || ip.id === doc.id);
        const image = data.image || matchingInitial?.image || '';
        return { id: doc.id, ...data, image } as Product;
      });
      console.log('Menu: Produtos carregados:', fetchedProducts.length);
      if (fetchedProducts.length > 0) {
        const sorted = fetchedProducts.sort((a, b) => {
          const oA = typeof a.order === 'number' ? a.order : 9999;
          const oB = typeof b.order === 'number' ? b.order : 9999;
          if (oA !== oB) return oA - oB;
          return (a.title || '').localeCompare(b.title || '');
        });
        setProducts(sorted);
      } else {
        const sorted = [...initialProducts].sort((a, b) => {
          const oA = typeof a.order === 'number' ? a.order : 9999;
          const oB = typeof b.order === 'number' ? b.order : 9999;
          if (oA !== oB) return oA - oB;
          return (a.title || '').localeCompare(b.title || '');
        });
        setProducts(sorted);
      }
      setLoading(false);
    }, (error) => {
      console.error('Menu: Erro ao carregar produtos:', error);
      const sorted = [...initialProducts].sort((a, b) => {
        const oA = typeof a.order === 'number' ? a.order : 9999;
        const oB = typeof b.order === 'number' ? b.order : 9999;
        if (oA !== oB) return oA - oB;
        return (a.title || '').localeCompare(b.title || '');
      });
      setProducts(sorted);
      setLoading(false);
    });

    const unsubCategories = onSnapshot(collection(db, 'categorias'), (snapshot) => {
      const catMap = new Map<string, Category>();
      snapshot.docs.forEach(doc => {
        catMap.set(doc.id, { id: doc.id, ...doc.data() } as Category);
      });
      const fetchedCategories = Array.from(catMap.values());
      console.log('Menu: Categorias carregadas:', fetchedCategories.length);
      if (fetchedCategories.length > 0) {
        const sorted = fetchedCategories.sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));
        setCategories(sorted);
      } else {
        const sorted = [...initialCategories].sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));
        setCategories(sorted);
      }
    }, (error) => {
      console.error('Menu: Erro ao carregar categorias:', error);
      const sorted = [...initialCategories].sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));
      setCategories(sorted);
    });

    const unsubSides = onSnapshot(collection(db, 'acompanhamentos'), (snapshot) => {
      const fetchedSides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Side));
      setSides(fetchedSides);
    }, (error) => {
      console.error('Menu: Erro ao carregar acompanhamentos:', error);
    });

    const unsubGalleries = onSnapshot(collection(db, 'galerias'), (snapshot) => {
      setGalleries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImageGallery)));
    }, (error) => {
      console.error('Menu: Erro ao carregar galerias:', error);
    });

    const unsubB2bProfiles = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      const b2bOrders = snapshot.docs
        .map(doc => doc.data())
        .filter((o: any) => o.isB2B || o.isPJ);
      const profilesMap: Record<string, any> = {};
      b2bOrders.forEach((o: any) => {
        const name = o.b2bCompanyName || o.customerName;
        if (name && !profilesMap[name.toLowerCase()]) {
          profilesMap[name.toLowerCase()] = {
            name: name,
            manager: o.b2bManagerName || '',
            phone: o.phone || '',
            address: o.b2bAddress || o.address || ''
          };
        }
      });
      setB2bProfiles(Object.values(profilesMap));
    }, (error) => {
      console.error('Menu: Erro ao carregar pedidos para perfis B2B:', error);
    });

    return () => {
      unsubProducts();
      unsubCategories();
      unsubSides();
      unsubGalleries();
      unsubB2bProfiles();
    };
  }, []);

  // Load B2B Profiles for Autocomplete
  useEffect(() => {
    if (!db) return;
    try {
      const q = query(collection(db, 'pedidos'));
      const unsub = onSnapshot(q, (snapshot) => {
        const uniqueProfilesMap: Record<string, any> = {};
        snapshot.docs.forEach(docSnap => {
          const d = docSnap.data();
          if (d.isB2B || d.isPJ) {
            const companyName = d.b2bCompanyName || d.customerName || '';
            const key = companyName.toLowerCase().trim();
            if (key && !uniqueProfilesMap[key]) {
              uniqueProfilesMap[key] = {
                name: companyName,
                manager: d.b2bManagerName || '',
                phone: d.phone || '',
                address: d.b2bAddress || d.address || ''
              };
            }
          }
        });
        setB2bProfiles(Object.values(uniqueProfilesMap));
      });
      return () => unsub();
    } catch (e) {
      console.error("Error loading B2B profiles catalog:", e);
    }
  }, []);

  // Check localStorage for saved B2B profile
  useEffect(() => {
    const saved = localStorage.getItem('b2b_profile_save');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.name) setB2bName(parsed.name);
        if (parsed.manager) setB2bResponsibleName(parsed.manager);
        if (parsed.phone) setB2bPhone(parsed.phone);
        if (parsed.address) setB2bAddress(parsed.address);
        setIsReturningB2b(true);
      } catch (e) {}
    }
  }, []);

  const getDishTrackedStockInfo = (productOrId: Product | string) => {
    const prod = typeof productOrId === 'string' ? products.find(p => p.id === productOrId) : productOrId;
    if (!prod) return { isTracked: false, stockQuantity: Infinity, masterProd: null };

    // Verificação direta no produto
    if (prod.trackStock) {
      return {
        isTracked: true,
        stockQuantity: typeof prod.stockQuantity === 'number' ? prod.stockQuantity : 0,
        masterProd: prod
      };
    }

    // Busca se existe prato irmão com mesmo nome canônico que tenha controle de estoque
    const key = getCanonicalDishKey(prod.title);
    if (key) {
      const counterpart = products.find(p => !p.isCombo && p.trackStock && getCanonicalDishKey(p.title) === key);
      if (counterpart) {
        return {
          isTracked: true,
          stockQuantity: typeof counterpart.stockQuantity === 'number' ? counterpart.stockQuantity : 0,
          masterProd: counterpart
        };
      }
    }

    return { isTracked: false, stockQuantity: Infinity, masterProd: prod };
  };

  const getProductTotalInCart = (productId: string, cartList: CartItem[] = cart): number => {
    const targetProd = products.find(p => p.id === productId);
    const targetKey = targetProd ? getCanonicalDishKey(targetProd.title) : '';

    return cartList.reduce((sum, item) => {
      let count = 0;
      // 1. Item avulso no carrinho
      if (!item.comboOptions?.items || item.comboOptions.items.length === 0) {
        if (item.productId === productId) {
          count += item.quantity;
        } else if (targetKey) {
          const itemProd = products.find(p => p.id === item.productId);
          if (itemProd && getCanonicalDishKey(itemProd.title) === targetKey) {
            count += item.quantity;
          }
        }
      }
      // 2. Pratos selecionados dentro de combos
      if (item.comboOptions?.items) {
        for (const sub of item.comboOptions.items) {
          if (sub.productId === productId) {
            count += (sub.quantity * item.quantity);
          } else if (targetKey) {
            const subProd = products.find(p => p.id === sub.productId);
            const subKey = subProd ? getCanonicalDishKey(subProd.title) : getCanonicalDishKey(sub.productTitle);
            if (subKey === targetKey) {
              count += (sub.quantity * item.quantity);
            }
          }
        }
      }
      return sum + count;
    }, 0);
  };

  const getProductAvailableStock = (productOrId: Product | string, cartList: CartItem[] = cart): number => {
    const prod = typeof productOrId === 'string' ? products.find(p => p.id === productOrId) : productOrId;
    if (!prod) return Infinity;

    const stockInfo = getDishTrackedStockInfo(prod);
    if (!stockInfo.isTracked) return Infinity;

    const inCart = getProductTotalInCart(prod.id, cartList);
    return Math.max(0, stockInfo.stockQuantity - inCart);
  };

  const addToCart = (product: Product, customQty: number = 1) => {
    if (product.trackStock) {
      const remaining = getProductAvailableStock(product);
      if (remaining <= 0) {
        toast.error('Este produto está esgotado para pronta entrega no momento.');
        return;
      }
      if (customQty > remaining) {
        toast.error(`Restam apenas ${remaining} unidades deste produto disponíveis.`);
        return;
      }
    }

    const hasSizesOpt = !!(product.sizes && product.sizes.length > 0);
    const hasExclusionsOpt = !!(product.isMeal && product.ingredients && product.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
    const hasSidesOpt = !!(product.isMeal && product.allowedSides && product.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
    const isCustomCakeOpt = !!product.isCustomCake;
    const isCustomSandwichOpt = !!product.isCustomSandwich;
    
    // If it requires complex customization (exclusions, sides, cake, or sandwich selection)
    const requiresComplexCustomization = hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;

    // If we have selectedSize from details modal and NO complex customization is needed, add directly!
    if (hasSizesOpt && selectedSize && !requiresComplexCustomization) {
      setCart(prev => {
        const existing = prev.find(item => item.productId === product.id && !item.mealOptions && item.selectedSize?.id === selectedSize.id);
        if (existing) {
          return prev.map(item => item === existing ? { ...item, quantity: item.quantity + customQty } : item);
        }
        return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: customQty, selectedSize: selectedSize }];
      });
      return;
    }

    const requiresCustomization = hasSizesOpt || hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;

    if (requiresCustomization) {
      setSelectedProductForCustom(product);
      setMealSelections({
        removals: []
      });
      setSideQuantities({});
      
      // Preserve existing selectedSize if valid for this product, otherwise set first option
      if (product.sizes && product.sizes.length > 0) {
        const isAlreadySelectedSizeValid = selectedSize && product.sizes.some(s => s.id === selectedSize.id);
        if (!isAlreadySelectedSizeValid) {
          setSelectedSize(product.sizes[0]);
        }
      } else {
        setSelectedSize(null);
      }
      
      if (product.isCustomCake) {
        setSelectedCakeSize('');
        setSelectedDough('');
        setSelectedFillings([]);
        setSelectedTopping('');
        setSelectedTopper('');
        setSelectedStyleNumber(null);
      }

      if (product.isCustomSandwich) {
        setSelectedSandwichFillings([]);
      }
      setIsCustomModalOpen(true);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && !item.mealOptions && !item.selectedSize);
      if (existing) {
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + customQty } : item);
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: customQty }];
    });
  };

  const incrementSizeQty = (product: Product, size: ProductSize) => {
    if (product.trackStock) {
      const remaining = getProductAvailableStock(product);
      if (remaining <= 0) {
        toast.error(`Limite de estoque atingido para este produto.`);
        return;
      }
    }
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.selectedSize?.id === size.id && !item.mealOptions && !item.cakeOptions);
      if (existing) {
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: Math.random().toString(36).substr(2, 9), productId: product.id, quantity: 1, selectedSize: size }];
    });
  };

  const decrementSizeQty = (product: Product, size: ProductSize) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.selectedSize?.id === size.id && !item.mealOptions && !item.cakeOptions);
      if (existing) {
        if (existing.quantity <= 1) {
          return prev.filter(item => item !== existing);
        }
        return prev.map(item => item === existing ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev;
    });
  };

  const getMaxSandwichFillings = (sizeName: string): number => {
    const match = sizeName.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 1;
  };

  const addMealToCart = () => {
    if (!selectedProductForCustom) return;

    if (selectedProductForCustom.isCustomSandwich) {
      const activeFillings = (Object.entries(sandwichFillingQuantities) as [string, number][])
        .filter(([_, qty]) => qty > 0)
        .map(([name, qty]) => ({ name, qty }));

      if (activeFillings.length === 0) {
        toast.error('Escolha pelo menos 1 opção!');
        return;
      }

      setCart(prev => {
        let currentCart = [...prev];

        for (const { name, qty } of activeFillings) {
          const newSandwichOptions = {
            fillings: [name]
          };

          const existing = currentCart.find(item =>
            item.productId === selectedProductForCustom.id &&
            ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
            item.sandwichOptions &&
            JSON.stringify(item.sandwichOptions.fillings) === JSON.stringify(newSandwichOptions.fillings)
          );

          if (existing) {
            currentCart = currentCart.map(item =>
              item.id === existing.id ? { ...item, quantity: item.quantity + qty } : item
            );
          } else {
            currentCart.push({
              id: Math.random().toString(36).substr(2, 9),
              productId: selectedProductForCustom.id,
              quantity: qty,
              sandwichOptions: newSandwichOptions,
              selectedSize: selectedSize || undefined
            });
          }
        }

        return currentCart;
      });

      setIsCustomModalOpen(false);
      setSelectedProductForCustom(null);
      setSelectedSize(null);
      return;
    }

    if (selectedProductForCustom.isCustomCake) {
      const maxFillings = settings.cakeFillingsMax || 2;
      if (selectedFillings.length > maxFillings) {
        toast.error(`Escolha no máximo ${maxFillings} recheios!`);
        return;
      }
      
      setCart(prev => {
        const newCakeOptions = {
          size: selectedCakeSize,
          dough: selectedDough,
          fillings: selectedFillings,
          topping: selectedTopping,
          topper: selectedTopper,
          styleNumber: selectedStyleNumber || undefined
        };
        
        const existing = prev.find(item => 
          item.productId === selectedProductForCustom.id && 
          item.cakeOptions &&
          item.cakeOptions.size === newCakeOptions.size &&
          item.cakeOptions.dough === newCakeOptions.dough &&
          item.cakeOptions.topping === newCakeOptions.topping &&
          item.cakeOptions.topper === newCakeOptions.topper &&
          item.cakeOptions.styleNumber === newCakeOptions.styleNumber &&
          JSON.stringify([...(item.cakeOptions.fillings || [])].sort()) === JSON.stringify([...newCakeOptions.fillings].sort())
        );

        if (existing) {
          return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
        }

        return [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            productId: selectedProductForCustom.id,
            quantity: customItemQuantity,
            cakeOptions: newCakeOptions
          }
        ];
      });

      setIsCustomModalOpen(false);
      setSelectedProductForCustom(null);
      return;
    }
    
    const selectedSides: Side[] = [];
    Object.entries(sideQuantities).forEach(([id, qty]) => {
      const side = sides.find(s => s.id === id);
      if (side) {
        for (let i = 0; i < (qty as number); i++) {
          selectedSides.push(side);
        }
      }
    });

    const newMealOptions = selectedProductForCustom.isMeal ? {
      removals: mealSelections.removals,
      sides: selectedSides
    } : undefined;

    setCart(prev => {
      const existing = prev.find(item => 
        item.productId === selectedProductForCustom.id && 
        ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
        (!newMealOptions || (
          JSON.stringify([...(item.mealOptions?.removals || [])].sort()) === JSON.stringify([...newMealOptions.removals].sort()) &&
          JSON.stringify([...(item.mealOptions?.sides || [])].map(s => s.id).sort()) === JSON.stringify([...newMealOptions.sides].map(s => s.id).sort())
        ))
      );

      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
      }

      return [
        ...prev, 
        { 
          id: Math.random().toString(36).substr(2, 9), 
          productId: selectedProductForCustom.id, 
          quantity: customItemQuantity,
          mealOptions: newMealOptions,
          selectedSize: selectedSize || undefined
        }
      ];
    });

    setIsCustomModalOpen(false);
    setSelectedProductForCustom(null);
    setSelectedSize(null);
  };

  const addDetailedProductToCart = (product: Product) => {
    if (product.trackStock) {
      const remaining = getProductAvailableStock(product);
      const qtyToAdd = product.isCustomSandwich
        ? (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0)
        : customItemQuantity;
      if (remaining <= 0) {
        toast.error('Este produto está esgotado para pronta entrega no momento.');
        return;
      }
      if (qtyToAdd > remaining) {
        toast.error(`Restam apenas ${remaining} unidades deste produto disponíveis.`);
        return;
      }
    }

    if (product.isCustomSandwich) {
      const activeFillings = (Object.entries(sandwichFillingQuantities) as [string, number][])
        .filter(([_, qty]) => qty > 0)
        .map(([name, qty]) => ({ name, qty }));

      if (activeFillings.length === 0) {
        toast.error('Escolha pelo menos 1 opção!');
        return;
      }

      setCart(prev => {
        let currentCart = [...prev];

        for (const { name, qty } of activeFillings) {
          const newSandwichOptions = {
            fillings: [name]
          };

          const existing = currentCart.find(item =>
            item.productId === product.id &&
            ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
            item.sandwichOptions &&
            JSON.stringify(item.sandwichOptions.fillings) === JSON.stringify(newSandwichOptions.fillings)
          );

          if (existing) {
            currentCart = currentCart.map(item =>
              item.id === existing.id ? { ...item, quantity: item.quantity + qty } : item
            );
          } else {
            currentCart.push({
              id: Math.random().toString(36).substr(2, 9),
              productId: product.id,
              quantity: qty,
              sandwichOptions: newSandwichOptions,
              selectedSize: selectedSize || undefined
            });
          }
        }

        return currentCart;
      });

      setSelectedProductForDetails(null);
      setSelectedSize(null);
      setSelectedSandwichFillings([]);
      toast.success('Adicionado com sucesso ao pedido!');
      return;
    }

    if (product.isCustomCake) {
      const maxFillings = settings.cakeFillingsMax || 2;
      if (selectedFillings.length > maxFillings) {
        toast.error(`Escolha no máximo ${maxFillings} recheios!`);
        return;
      }
      
      setCart(prev => {
        const newCakeOptions = {
          size: selectedCakeSize,
          dough: selectedDough,
          fillings: selectedFillings,
          topping: selectedTopping,
          topper: selectedTopper,
          styleNumber: selectedStyleNumber || undefined
        };
        
        const existing = prev.find(item => 
          item.productId === product.id && 
          item.cakeOptions &&
          item.cakeOptions.size === newCakeOptions.size &&
          item.cakeOptions.dough === newCakeOptions.dough &&
          item.cakeOptions.topping === newCakeOptions.topping &&
          item.cakeOptions.topper === newCakeOptions.topper &&
          item.cakeOptions.styleNumber === newCakeOptions.styleNumber &&
          JSON.stringify([...(item.cakeOptions.fillings || [])].sort()) === JSON.stringify([...newCakeOptions.fillings].sort())
        );

        if (existing) {
          return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
        }

        return [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            productId: product.id,
            quantity: customItemQuantity,
            cakeOptions: newCakeOptions
          }
        ];
      });

      setSelectedProductForDetails(null);
      toast.success('Adicionado com sucesso ao pedido!');
      return;
    }
    
    const selectedSides: Side[] = [];
    Object.entries(sideQuantities).forEach(([id, qty]) => {
      const side = sides.find(s => s.id === id);
      if (side) {
        for (let i = 0; i < (qty as number); i++) {
          selectedSides.push(side);
        }
      }
    });

    const newMealOptions = product.isMeal ? {
      removals: mealSelections.removals,
      sides: selectedSides
    } : undefined;

    setCart(prev => {
      const existing = prev.find(item => 
        item.productId === product.id && 
        ((!item.selectedSize && !selectedSize) || (item.selectedSize?.id === selectedSize?.id)) &&
        (!newMealOptions || (
          JSON.stringify([...(item.mealOptions?.removals || [])].sort()) === JSON.stringify([...newMealOptions.removals].sort()) &&
          JSON.stringify([...(item.mealOptions?.sides || [])].map(s => s.id).sort()) === JSON.stringify([...newMealOptions.sides].map(s => s.id).sort())
        ))
      );

      if (existing) {
        return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + customItemQuantity } : item);
      }

      return [
        ...prev, 
        { 
          id: Math.random().toString(36).substr(2, 9), 
          productId: product.id, 
          quantity: customItemQuantity,
          mealOptions: newMealOptions,
          selectedSize: selectedSize || undefined
        }
      ];
    });

    setSelectedProductForDetails(null);
    setSelectedSize(null);
    toast.success('Adicionado com sucesso ao pedido!');
  };

  const handleAddComboToCart = () => {
    if (!selectedComboProduct) return;
    const targetQty = Number(selectedComboProduct.comboQuantity) || 5;
    const currentTotal = (Object.values(comboDishSelections) as number[]).reduce((a, b) => a + b, 0);

    if (currentTotal !== targetQty) {
      toast.error(`Por favor, selecione exatamente ${targetQty} marmitas para completar o combo. Você selecionou ${currentTotal}.`);
      return;
    }

    // Valida estoque para cada prato escolhido no combo que possui pronta entrega ativo
    for (const [dishId, qty] of Object.entries(comboDishSelections)) {
      const dish = products.find(p => p.id === dishId);
      if (dish && dish.trackStock) {
        const availableStock = getProductAvailableStock(dish);
        if ((qty as number) > availableStock) {
          toast.error(`O prato "${dish.title}" tem apenas ${availableStock} un disponíveis.`);
          return;
        }
      }
    }

    const comboItems = Object.entries(comboDishSelections)
      .filter(([_, qty]) => (qty as number) > 0)
      .map(([dishId, qty]) => {
        const dish = products.find(p => p.id === dishId);
        return {
          productId: dishId,
          productTitle: dish?.title || 'Prato',
          quantity: qty as number
        };
      });

    setCart(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        productId: selectedComboProduct.id,
        quantity: 1,
        comboOptions: {
          items: comboItems
        }
      }
    ]);

    setSelectedComboProduct(null);
    setComboDishSelections({});
    toast.success('Combo adicionado com sucesso ao seu pedido!');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === cartItemId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.id === cartItemId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.id !== cartItemId);
    });
  };

  const cartItemsCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => {
    const product = products.find(p => p.id === item.productId);
    const basePrice = item.selectedSize ? item.selectedSize.price : ((product?.price && product.price > 0) ? product.price : (product?.oldPrice || 0));
    let itemPrice = basePrice;
    if (item.mealOptions?.sides) {
      itemPrice += item.mealOptions.sides.reduce((sum, s) => sum + s.price, 0);
    }
    return total + itemPrice * item.quantity;
  }, 0);

  const checkMarmitifyLimit = () => {
    return true;
  };

  const validateCartItems = () => {
    return { isValid: true, message: '' };
  };

  const handleFinalizar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (cart.length === 0) {
      toast.error('Seu carrinho está vazio!');
      return;
    }

    // Validações de campos obrigatórios e formato de e-mail/telefone
    if (!formData.nome.trim()) {
      toast.error('O campo Nome Completo é obrigatório!');
      return;
    }
    if (!formData.telefone.trim()) {
      toast.error('O campo Telefone é obrigatório!');
      return;
    }
    const phoneDigits = formData.telefone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Por favor, insira um telefone válido com DDD!');
      return;
    }
    if (!formData.aniversario.trim()) {
      toast.error('O campo Aniversário é obrigatório!');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(formData.aniversario.trim())) {
      toast.error('Por favor, insira o aniversário no formato DD/MM!');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('O campo E-mail é obrigatório!');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error('Por favor, insira um e-mail válido!');
      return;
    }
    if (!formData.street.trim()) {
      toast.error('O campo Rua/Avenida é obrigatório!');
      return;
    }
    if (!formData.city.trim()) {
      toast.error('O campo Cidade é obrigatório!');
      return;
    }
    if (!formData.state.trim()) {
      toast.error('O campo Estado é obrigatório!');
      return;
    }

    const validation = validateCartItems();
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }
    
    if (!checkMarmitifyLimit()) {
      return;
    }

    if (settings?.minOrderValue && settings.minOrderValue > 0 && cartTotal < settings.minOrderValue) {
      toast.error(`O valor mínimo para realizar o pedido é de ${currencySymbol} ${settings.minOrderValue.toFixed(2).replace('.', ',')}.`);
      return;
    }

    if (settings?.deliveryNeighborhoods && settings.deliveryNeighborhoods.length > 0 && !formData.deliveryNeighborhoodId) {
      toast.error('Por favor, selecione o seu bairro para entrega.');
      return;
    }

    setIsSubmitting(true);
    try {
      const hasConsultItems = cart.some(item => {
        const p = products.find(prod => prod.id === item.productId);
        return p?.priceType === 'consult' || p?.isCustomCake === true;
      });
      
      const orderItems = cart.map(item => {
        const product = products.find(p => p.id === item.productId)!;
        const basePrice = item.selectedSize ? item.selectedSize.price : ((product.price && product.price > 0) ? product.price : (product.oldPrice || 0));
        let itemPrice = basePrice;
        if (item.mealOptions?.sides) {
          itemPrice += item.mealOptions.sides.reduce((sum, s) => sum + s.price, 0);
        }

        const cleanedMealOptions = item.mealOptions ? {
          removals: item.mealOptions.removals || [],
          sides: (item.mealOptions.sides || []).map(side => ({
            id: side.id,
            name: side.name,
            price: side.price,
            type: side.type || 'side'
          }))
        } : null;

        return {
          title: item.selectedSize ? `${product.title} (${item.selectedSize.name})` : product.title,
          quantity: item.quantity,
          price: itemPrice,
          priceType: product.priceType || 'fixed',
          mealOptions: cleanedMealOptions,
          selectedSize: item.selectedSize || null,
          cakeOptions: item.cakeOptions || null,
          sandwichOptions: item.sandwichOptions || null,
          comboOptions: item.comboOptions || null
        };
      });

      const deliveryFee = Number(formData.deliveryFee || 0);
      const calculatedTax = 0;
      const finalTotalWithTax = cartTotal + deliveryFee;

      const formattedDateOnly = formData.scheduledDate
        ? (formData.scheduledDate.includes('-')
            ? (() => {
                const parts = formData.scheduledDate.split('-');
                if (parts.length === 3) {
                  return `${parts[2]}/${parts[1]}/${parts[0]}`;
                }
                return formData.scheduledDate;
              })()
            : formData.scheduledDate)
        : '';

      const formattedPickupDate = formData.wantsReadyDelivery 
        ? 'Pronta Entrega (Sob Consulta)' 
        : (formattedDateOnly ? `${formattedDateOnly} (DELIVERY)` : '');

      const orderData: Omit<Order, 'id'> = {
        customerName: formData.nome,
        phone: formData.telefone,
        address: `${formData.street}, ${formData.number || 'S/N'} - ${formData.city} / ${formData.state}`,
        street: formData.street,
        number: formData.number || '',
        zipCode: '',
        city: formData.city,
        state: formData.state,
        deliveryNeighborhood: formData.deliveryNeighborhoodName || '',
        deliveryFee: deliveryFee,
        pickupDate: formattedPickupDate,
        deliveryOption: 'delivery',
        scheduledDate: formData.wantsReadyDelivery ? 'Pronta Entrega' : (formattedDateOnly || ''),
        wantsReadyDelivery: !!formData.wantsReadyDelivery,
        scheduledTime: '',
        deliveryStatus: 'pending',
        birthday: formData.aniversario || '',
        observation: formData.observacao || '',
        email: formData.email || '',
        items: orderItems,
        total: finalTotalWithTax,
        subtotal: cartTotal,
        taxRate: 0,
        taxAmount: 0,
        createdAt: serverTimestamp(),
        orderLanguage: settings.language || 'pt'
      };

      console.log('Finalizando pedido...', orderData);
      await addDoc(collection(db, 'pedidos'), orderData);
      
      // Baixa automática e proporcional do estoque dos produtos com pronta entrega ativo (tanto avulso quanto nos combos)
      try {
        const deductionsPerProduct: Record<string, number> = {};

        for (const cartItem of cart) {
          // 1. Pratos selecionados dentro do combo
          if (cartItem.comboOptions?.items && cartItem.comboOptions.items.length > 0) {
            for (const sub of cartItem.comboOptions.items) {
              if (sub.productId) {
                const qtyDeducted = (Number(sub.quantity) || 0) * (Number(cartItem.quantity) || 1);
                deductionsPerProduct[sub.productId] = (deductionsPerProduct[sub.productId] || 0) + qtyDeducted;
              }
            }
          }

          // 2. Prato avulso (não combo)
          if (cartItem.productId) {
            if (!cartItem.comboOptions?.items || cartItem.comboOptions.items.length === 0) {
              const qtyDeducted = Number(cartItem.quantity) || 0;
              deductionsPerProduct[cartItem.productId] = (deductionsPerProduct[cartItem.productId] || 0) + qtyDeducted;
            } else {
              // Se o próprio item de Combo tiver controle de estoque ativo, deduz a embalagem/combo também
              const comboProd = products.find(p => p.id === cartItem.productId);
              if (comboProd && comboProd.trackStock) {
                deductionsPerProduct[cartItem.productId] = (deductionsPerProduct[cartItem.productId] || 0) + (Number(cartItem.quantity) || 0);
              }
            }
          }
        }

        const stockUpdates = Object.entries(deductionsPerProduct).map(async ([productId, qtyToDeduct]) => {
          const prod = products.find(p => p.id === productId);
          if (prod) {
            const key = getCanonicalDishKey(prod.title);
            const targets = key 
              ? products.filter(p => !p.isCombo && (p.id === prod.id || getCanonicalDishKey(p.title) === key))
              : [prod];
            
            for (const target of targets) {
              const stockInfo = getDishTrackedStockInfo(target);
              if (stockInfo.isTracked) {
                const currentStock = typeof target.stockQuantity === 'number' ? target.stockQuantity : stockInfo.stockQuantity;
                const newStock = Math.max(0, currentStock - qtyToDeduct);
                await updateDoc(doc(db, 'produtos', target.id), {
                  trackStock: true,
                  stockQuantity: newStock
                });
              }
            }
          }
        });
        await Promise.all(stockUpdates);
      } catch (errStock) {
        console.error('Erro ao atualizar estoque proporcional:', errStock);
      }
      
      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      let message = `*${t.whatsappOrder} - ${settings.brandName || settings.slug}*\n`;
      message += `*${t.whatsappDate}:* ${dateStr} ${t.whatsappAt} ${timeStr}\n\n`;
      
      message += `*--- ${t.whatsappData} ---*\n`;
      message += `*${t.fullName}:* ${formData.nome}\n`;
      message += `*${t.phone}:* ${formData.telefone}\n`;
      message += `*${t.email}:* ${formData.email}\n`;
      message += `*${t.birthday}:* ${formData.aniversario}\n`;
      if (formData.deliveryNeighborhoodName) {
        message += `*📍 Bairro de Entrega:* ${formData.deliveryNeighborhoodName}\n`;
        message += `*🛵 Taxa de Entrega:* ${formData.deliveryFee > 0 ? `${currencySymbol}${formData.deliveryFee.toFixed(2).replace('.', ',')}` : (formData.deliveryNeighborhoodId === 'other' ? 'A combinar via WhatsApp' : 'Grátis')}\n`;
      }
      message += `*${t.street}:* ${formData.street}\n`;
      message += `*${t.number}:* ${formData.number || '-'}\n`;
      message += `*${t.state}:* ${formData.state}\n`;
      message += `*${t.city}:* ${formData.city}\n`;
      message += `*${t.observation}:* ${formData.observacao || '-'}\n\n`;

      message += `*--- ${t.whatsappItems} ---*\n`;
      orderItems.forEach((item, idx) => {
        const originalItem = cart[idx];
        if (item.priceType === 'consult') {
          message += `• ${item.quantity}x ${item.title} - (Value to Consult)\n`;
        } else {
          message += `• ${item.quantity}x ${item.title} - ${currencySymbol}${(item.price * item.quantity).toFixed(2)}\n`;
        }
        if (item.mealOptions) {
          if (item.mealOptions.removals.length > 0) {
            message += `  (Excluding: ${item.mealOptions.removals.join(', ')})\n`;
          }
          if (item.mealOptions.sides.length > 0) {
            const normalSidesArr = item.mealOptions.sides.filter(s => s.type !== 'swap');
            const swapSidesArr = item.mealOptions.sides.filter(s => s.type === 'swap');
            
            if (normalSidesArr.length > 0) {
              const grouped = normalSidesArr.reduce((acc: Record<string, number>, s) => { acc[s.name] = (acc[s.name] || 0) + 1; return acc; }, {});
              const str = Object.entries(grouped).map(([name, qty]) => `${name}${Number(qty) > 1 ? ` (${qty}x)` : ''}`).join(', ');
              message += `  (Acompanhamentos: ${str})\n`;
            }
            if (swapSidesArr.length > 0) {
              const grouped = swapSidesArr.reduce((acc: Record<string, number>, s) => { acc[s.name] = (acc[s.name] || 0) + 1; return acc; }, {});
              const str = Object.entries(grouped).map(([name, qty]) => `${name}${Number(qty) > 1 ? ` (${qty}x)` : ''}`).join(', ');
              message += `  (Trocas: ${str})\n`;
            }
          }
        }
        if (originalItem && originalItem.cakeOptions) {
          const opts = originalItem.cakeOptions;
          if (opts.size) message += `  (Tamanho: ${opts.size})\n`;
          if (opts.dough) message += `  (Massa: ${opts.dough})\n`;
          if (opts.fillings && opts.fillings.length > 0) message += `  (Recheios: ${opts.fillings.join(' + ')})
`;
          if (opts.topping) message += `  (Cobertura: ${opts.topping})\n`;
          if (opts.topper) message += `  (Topo: ${opts.topper})\n`;
          if (opts.styleNumber) message += `  (Referência de Estilo: Foto Nº ${opts.styleNumber})\n`;
        }
        if (originalItem && originalItem.sandwichOptions) {
          const opts = originalItem.sandwichOptions;
          if (opts.fillings && opts.fillings.length > 0) message += `  (Estado: ${opts.fillings.join(' + ')})\n`;
        }
        if (originalItem && originalItem.comboOptions?.items && originalItem.comboOptions.items.length > 0) {
          message += `  (Sabores do Combo:\n`;
          originalItem.comboOptions.items.forEach(sub => {
            message += `    • ${sub.quantity}x ${sub.productTitle}\n`;
          });
          message += `  )\n`;
        }
      });

      const finalTotalWithTax2 = cartTotal + Number(formData.deliveryFee || 0);

      if (formData.deliveryNeighborhoodName && formData.deliveryFee > 0) {
        message += `\n*Subtotal dos Itens:* ${currencySymbol}${cartTotal.toFixed(2)}`;
        message += `\n*Taxa de Entrega (${formData.deliveryNeighborhoodName}):* ${currencySymbol}${Number(formData.deliveryFee).toFixed(2)}`;
      }
      message += `\n*${t.whatsappTotal}:* ${currencySymbol}${finalTotalWithTax2.toFixed(2)}\n`;
      
      if (hasConsultItems) {
        message += `\n⚠️ *${t.consultMessage}*\n`;
      }
      
      message += `\n${settings.whatsappClosingMessage || 'Obrigada pelo pedido, aguarde que entraremos em contato para confirmação!'}`;

      const encodedMessage = encodeURIComponent(message);
      const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '');
      
      if (!cleanPhone) {
        toast.error('Erro: Número para contato não configurado corretamente no painel administrativo.');
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const whatsappUrl = isIOS 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
        : `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      setStandardSuccessUrls({ whatsapp: whatsappUrl });
      setCheckoutStep('channels');
      setHasRedirected(false);
      toast.success('Pedido salvo! Selecione a forma de envio abaixo.');
    } catch (error) {
      console.error("Erro ao salvar pedido:", error);
      toast.error('Erro ao finalizar pedido. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteStandardOrder = () => {
    setCart([]);
    setIsModalOpen(false);
    setCheckoutStep('summary');
    setStandardSuccessUrls(null);
    setFormData({ 
      nome: '', 
      telefone: '', 
      endereco: '', 
      street: '',
      number: '',
      state: '',
      city: '',
      aniversario: '', 
      observacao: '', 
      email: '' 
    });
  };

  const handleCompleteB2bOrder = () => {
    setCart([]);
    setIsModalOpen(false);
    setCheckoutStep('summary');
    setB2bSuccessUrls(null);
  };

   const handleFinalizarB2b = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cart.length === 0) {
      toast.error('Seu carrinho está vazio!');
      return;
    }

    const validation = validateCartItems();
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    if (!b2bName.trim() || !b2bResponsibleName.trim() || !b2bPhone.trim() || !b2bAddress.trim() || !b2bZipCode.trim() || !b2bCity.trim() || !b2bDate) {
      toast.error('Por favor, preencha todos os campos obrigatórios!');
      return;
    }

    const orderItems = cart.map(item => {
      const product = products.find(p => p.id === item.productId)!;
      let titleStr = item.selectedSize ? `${product.title} (${item.selectedSize.name})` : product.title;
      if (item.cakeOptions) {
        const parts = [];
        if (item.cakeOptions.size) parts.push(`Tamanho: ${item.cakeOptions.size}`);
        if (item.cakeOptions.dough) parts.push(`Massa: ${item.cakeOptions.dough}`);
        if (item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0) parts.push(`Recheios: ${item.cakeOptions.fillings.join(' + ')}`);
        if (item.cakeOptions.topping) parts.push(`Cobertura: ${item.cakeOptions.topping}`);
        if (item.cakeOptions.topper) parts.push(`Topo: ${item.cakeOptions.topper}`);
        if (item.cakeOptions.styleNumber) parts.push(`Estilo nº ${item.cakeOptions.styleNumber}`);
        titleStr += ` [${parts.join(', ')}]`;
      }
      if (item.sandwichOptions) {
        const parts = [];
        if (item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0) parts.push(`Estado: ${item.sandwichOptions.fillings.join(' + ')}`);
        titleStr += ` [${parts.join(', ')}]`;
      }
      if (item.comboOptions?.items && item.comboOptions.items.length > 0) {
        const parts = item.comboOptions.items.map(sub => `${sub.quantity}x ${sub.productTitle}`);
        titleStr += ` [Combo: ${parts.join(', ')}]`;
      }
      return {
        title: titleStr,
        quantity: item.quantity,
        price: 0,
        priceType: 'consult'
      };
    });

    const b2bOrderObj = {
      customerName: b2bName,
      phone: b2bPhone,
      address: b2bAddress,
      zipCode: b2bZipCode,
      city: b2bCity,
      pickupDate: b2bDate ? (() => {
        const [year, month, day] = b2bDate.split('-');
        return `${month}/${day}/${year}`;
      })() : '',
      birthday: '',
      observation: b2bObservation,
      email: '',
      items: orderItems,
      total: 0,
      createdAt: serverTimestamp(),
      orderLanguage: 'pt',
      isB2B: true,
      isPJ: true,
      b2bManagerName: b2bResponsibleName,
      b2bFrequency: b2bFrequency,
      b2bCompanyName: b2bName,
      b2bAddress: b2bAddress,
      b2bZipCode: b2bZipCode,
      b2bCity: b2bCity
    };

    try {
      console.log('Enviando solicitação de pedido corporativo B2B...', b2bOrderObj);
      await addDoc(collection(db, 'pedidos'), b2bOrderObj);

      // Baixa automática e proporcional do estoque dos produtos com pronta entrega ativo (tanto avulso quanto nos combos)
      try {
        const deductionsPerProduct: Record<string, number> = {};

        for (const cartItem of cart) {
          // 1. Pratos selecionados dentro do combo
          if (cartItem.comboOptions?.items && cartItem.comboOptions.items.length > 0) {
            for (const sub of cartItem.comboOptions.items) {
              if (sub.productId) {
                const qtyDeducted = (Number(sub.quantity) || 0) * (Number(cartItem.quantity) || 1);
                deductionsPerProduct[sub.productId] = (deductionsPerProduct[sub.productId] || 0) + qtyDeducted;
              }
            }
          }

          // 2. Prato avulso (não combo)
          if (cartItem.productId) {
            if (!cartItem.comboOptions?.items || cartItem.comboOptions.items.length === 0) {
              const qtyDeducted = Number(cartItem.quantity) || 0;
              deductionsPerProduct[cartItem.productId] = (deductionsPerProduct[cartItem.productId] || 0) + qtyDeducted;
            } else {
              const comboProd = products.find(p => p.id === cartItem.productId);
              if (comboProd && comboProd.trackStock) {
                deductionsPerProduct[cartItem.productId] = (deductionsPerProduct[cartItem.productId] || 0) + (Number(cartItem.quantity) || 0);
              }
            }
          }
        }

        const stockUpdates = Object.entries(deductionsPerProduct).map(async ([productId, qtyToDeduct]) => {
          const prod = products.find(p => p.id === productId);
          if (prod) {
            const key = getCanonicalDishKey(prod.title);
            const targets = key 
              ? products.filter(p => !p.isCombo && (p.id === prod.id || getCanonicalDishKey(p.title) === key))
              : [prod];
            
            for (const target of targets) {
              const stockInfo = getDishTrackedStockInfo(target);
              if (stockInfo.isTracked) {
                const currentStock = typeof target.stockQuantity === 'number' ? target.stockQuantity : stockInfo.stockQuantity;
                const newStock = Math.max(0, currentStock - qtyToDeduct);
                await updateDoc(doc(db, 'produtos', target.id), {
                  trackStock: true,
                  stockQuantity: newStock
                });
              }
            }
          }
        });
        await Promise.all(stockUpdates);
      } catch (errStock) {
        console.error('Erro ao atualizar estoque B2B:', errStock);
      }
      
      // Persist client details in localStorage so it autofills on subsequent visits!
      localStorage.setItem('b2b_profile_save', JSON.stringify({
        name: b2bName,
        manager: b2bResponsibleName,
        phone: b2bPhone,
        address: b2bAddress,
        zipCode: b2bZipCode,
        city: b2bCity
      }));
      setIsReturningB2b(true);

      const now = new Date();
      const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      let message = `*Pedido Corporativo - ${settings.brandName || settings.slug}*\n`;
      message += `*Data:* ${dateStr} às ${timeStr}\n\n`;
      message += `*--- DADOS DA EMPRESA ---*\n`;
      message += `*Razão Social / Nome Fantasia:* ${b2bName}\n`;
      message += `*Responsável / Gestor:* ${b2bResponsibleName}\n`;
      message += `*Telefone:* ${b2bPhone}\n`;
      message += `*Endereço de Entrega:* ${b2bAddress}\n`;
      message += `*CEP:* ${b2bZipCode}\n`;
      message += `*Cidade:* ${b2bCity}\n`;
      message += `*Frequência:* ${b2bFrequency === 'weekly' ? 'Contrato Semanal (Recorrente)' : 'Pedido Avulso'}\n`;
      message += `*Data Prevista de Início:* ${b2bOrderObj.pickupDate}\n`;
      if (b2bObservation) {
        message += `*Observações:* ${b2bObservation}\n`;
      }
      message += `\n*--- ITENS DO PEDIDO ---*\n`;
      orderItems.forEach(item => {
        message += `• ${item.quantity}x ${item.title}\n`;
      });
      message += `\n${settings.whatsappClosingMessage || 'Obrigada pelo pedido, aguarde que entraremos em contato para confirmação!'}\n`;
      
      const encodedMessage = encodeURIComponent(message);
      const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '');

      if (!cleanPhone) {
        toast.error('Número de contato do WhatsApp não configurado no painel administrativo.');
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const whatsappUrl = isIOS 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
        : `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

      // Save URLs and go to success channels page
      setB2bSuccessUrls({ whatsapp: whatsappUrl });
      setCheckoutStep('b2b_channels');
      setHasRedirected(false);
      toast.success('Pedido corporativo salvo! Escolha como deseja enviar abaixo.');
    } catch (error) {
      console.error('Erro ao salvar detalhes do pedido corporativo B2B:', error);
      toast.error('Falha ao enviar solicitação corporativa. Por favor, verifique e tente novamente.');
    }
  };

  if (activeScreen === 'intro') {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen p-4 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass max-w-sm w-full rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl flex flex-col items-center text-center space-y-6 sm:space-y-8"
        >
          {/* Logo Frame */}
          <div className="relative mt-2">
            <div 
              className="w-[160px] h-[160px] rounded-full p-1 bg-white shadow-md flex items-center justify-center overflow-hidden border-2"
              style={{ borderColor: settings.primaryColor }}
            >
              <img 
                src={settings.logo} 
                alt="Logo" 
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>

          {/* Texts Section */}
          <div className="space-y-3">
            <h1 
              className="text-3xl font-serif font-extrabold italic tracking-tight"
              style={{ color: settings.primaryColor }}
            >
              {renderTitle(settings.introTitle || settings.brandName || 'Lu das marmitas')}
            </h1>
            
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="h-[1px] w-12 bg-black/15" />
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: settings.primaryColor }} />
              <div className="h-[1px] w-12 bg-black/15" />
            </div>

            <p className="text-lg font-serif italic text-black/80 font-medium">
              {settings.introSubtitle || 'Comer bem é o primeiro passo para uma vida saudável.'}
            </p>
            
            <p 
              className="text-sm font-medium italic max-w-xs mx-auto"
              style={{ color: settings.primaryColor || '#865d39' }}
            >
              {settings.introDescription || 'Se você quer mais leveza, mais saúde e mais qualidade de vida... comece pelo básico bem feito: sua alimentação.'}
            </p>
          </div>

          {/* CTA Button */}
          <div className="w-full pt-2 space-y-3">
            <button
              onClick={() => {
                setActiveScreen('menu');
              }}
              className="w-full py-4 px-6 rounded-full font-bold text-sm tracking-widest uppercase shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
            >
              {settings.introButtonText || 'ACESSAR NOSSO CARDÁPIO'}
            </button>
            
            <p className="text-[10px] font-mono font-bold tracking-widest opacity-60 uppercase text-black pt-1">
              {settings.introBottomText || 'ALIMENTO • CORPO • ALMA'}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (activeScreen === 'selector') {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-screen p-4 select-none">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          className="w-full max-w-[605px] flex flex-col items-center space-y-4 sm:space-y-6 py-2 sm:py-6"
        >
          {/* Circular Header Logo */}
          <div 
            className="w-[166px] h-[166px] sm:w-[229px] sm:h-[229px] rounded-full p-1 flex items-center justify-center overflow-hidden border-2 flex-shrink-0"
            style={{ borderColor: settings.primaryColor }}
          >
            <img 
              src={settings.logo} 
              alt="Logo" 
              className="w-full h-full object-cover rounded-full bg-white"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-4xl font-serif font-bold tracking-tight text-center" style={{ color: settings.primaryColor || '#143D25' }}>
              {settings.selectorTitle || settings.brandName || 'Dendê Foods'}
            </h2>
            <p className="text-xs font-bold tracking-wide uppercase opacity-90 text-center" style={{ color: settings.primaryColor || '#143D25' }}>
              {settings.selectorSubtitle || 'Escolha sua experiência'}
            </p>
          </div>

          {/* Cards Grid - Lado a Lado na vertical e horizontal */}
          <div className="grid grid-cols-2 gap-3.5 w-full mt-4 sm:mt-6">
            {/* Card 1 */}
            {settings.catalog1Active !== false && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedCatalog('catalog1');
                  setActiveScreen('menu');
                }}
                className="bg-white/80 backdrop-blur-lg rounded-2xl p-2.5 flex flex-col items-center cursor-pointer text-center group border border-white/20 shadow-md justify-between"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/50 shadow-inner">
                  <img 
                    src={settings.catalog1Image || 'https://i.ibb.co/X0vYy7L/cakes.png'} 
                    alt="Catálogo 1" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="mt-2.5 space-y-1 w-full flex-grow flex flex-col justify-start">
                  <h3 className="text-xs sm:text-sm font-serif font-black uppercase tracking-wide transition-colors leading-tight" style={{ color: '#000000' }}>
                    {settings.catalog1Title || 'Acarajé & Pratos'}
                  </h3>
                  {settings.catalog1Desc && (
                    <p className="text-[10px] font-semibold leading-tight px-1 block line-clamp-2" style={{ color: '#000000' }}>
                      {settings.catalog1Desc}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {/* Card 2 */}
            {settings.catalog2Active !== false && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setSelectedCatalog('catalog2');
                  setActiveScreen('menu');
                }}
                className="bg-white/80 backdrop-blur-lg rounded-2xl p-2.5 flex flex-col items-center cursor-pointer text-center group border border-white/20 shadow-md justify-between"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/50 shadow-inner">
                  <img 
                    src={settings.catalog2Image || 'https://i.ibb.co/X0vYy7L/cakes.png'} 
                    alt="Catálogo 2" 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="mt-2.5 space-y-1 w-full flex-grow flex flex-col justify-start">
                  <h3 className="text-xs sm:text-sm font-serif font-black uppercase tracking-wide transition-colors leading-tight" style={{ color: '#000000' }}>
                    {settings.catalog2Title || 'Bebidas & Sobremesas'}
                  </h3>
                  {settings.catalog2Desc && (
                    <p className="text-[10px] font-semibold leading-tight px-1 block line-clamp-2" style={{ color: '#000000' }}>
                       {settings.catalog2Desc}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* Catalog 3 & 4 Buttons inside a beautiful unified container box card */}
          {(settings.catalog3Active !== false || settings.catalog4Active !== false) && (
            <div className="mt-6 w-full bg-white/80 backdrop-blur-lg rounded-3xl p-5 border border-white/20 shadow-md flex flex-col items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-black/45 mb-4 font-sans">
                {'Mais Cardápios'}
              </span>
              <div className="w-full flex flex-row gap-3 items-stretch justify-center">
                {settings.catalog3Active !== false && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedCatalog('catalog3');
                      setActiveScreen('menu');
                    }}
                    className="flex-1 py-4 px-3 rounded-full font-bold text-[10px] tracking-wider uppercase shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-white/10 text-center flex items-center justify-center min-h-[44px]"
                    style={{ 
                      backgroundColor: settings.primaryColor || '#143D25', 
                      color: getContrastText(settings.primaryColor || '#143D25') 
                    }}
                  >
                    {settings.catalog3Title || 'Baixo Carboidrato'}
                  </motion.button>
                )}
                {settings.catalog4Active !== false && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedCatalog('catalog4');
                      setActiveScreen('menu');
                    }}
                    className="flex-1 py-4 px-3 rounded-full font-bold text-[10px] tracking-wider uppercase shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-white/10 text-center flex items-center justify-center min-h-[44px]"
                    style={{ 
                      backgroundColor: settings.primaryColor || '#143D25', 
                      color: getContrastText(settings.primaryColor || '#143D25') 
                    }}
                  >
                    {settings.catalog4Title || 'Hipertróficas'}
                  </motion.button>
                )}
              </div>
            </div>
          )}

        </motion.div>
      </div>
    );
  }

  if (loading && activeScreen === 'menu') {
    return (
      <div className="flex-grow flex flex-col items-center justify-center min-h-[50vh] p-4 text-center select-none">
        <div 
          className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" 
          style={{ borderColor: settings.primaryColor }}
        />
        <p className="mt-4 font-sans font-semibold text-sm text-black/60">
          {'Carregando catálogo...'}
        </p>
      </div>
    );
  }

  const filteredCategories = categories.filter(category => {
    const cat = category.catalog || 'catalog1';
    
    // If a category belongs specifically to b2b/corporate, hide it from normal catalogs
    if (cat === 'catalog_b2b' || cat === 'b2b') {
      return false;
    }
    
    if (selectedCatalog) {
      return cat === 'both' || cat === 'all' || cat === selectedCatalog;
    }
    
    return true;
  }).sort((a, b) => (typeof a.order === 'number' ? a.order : 9999) - (typeof b.order === 'number' ? b.order : 9999));

  return (
    <div className="flex-grow flex flex-col items-center p-4 pb-32">
      {/* Removed catalog selector back button */}

      <div className="mt-8 mb-4 relative">
        <div 
          className="w-40 h-40 rounded-full bg-white p-1 shadow-2xl overflow-hidden flex items-center justify-center border-2"
          style={{ borderColor: settings.primaryColor }}
        >
          <img 
            src={
              selectedCatalog === 'catalog1'
                ? (settings.catalog1Image || settings.logo || 'https://i.ibb.co/fdW3vg3x/patitour-2026-09-04-T094721-613.png')
                : selectedCatalog === 'catalog2'
                  ? (settings.catalog2Image || 'https://i.ibb.co/68XwD57/meals.png')
                  : selectedCatalog === 'catalog3'
                    ? (settings.catalog3Image || settings.logo || 'https://i.ibb.co/fdW3vg3x/patitour-2026-09-04-T094721-613.png')
                    : selectedCatalog === 'catalog4'
                      ? (settings.catalog4Image || settings.logo || 'https://i.ibb.co/fdW3vg3x/patitour-2026-09-04-T094721-613.png')
                      : (settings.logo || 'https://i.ibb.co/fdW3vg3x/patitour-2026-09-04-T094721-613.png')
            } 
            alt="Logo" 
            className="w-full h-full object-cover rounded-full"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <h1 className="text-3xl font-serif font-extrabold italic mb-10 text-center tracking-tight" style={{ color: settings.primaryColor }}>
        {renderTitle(settings.introTitle || settings.brandName || 'Lu das marmitas')}
      </h1>

      {(() => {
        const text = selectedCatalog === 'catalog1'
          ? (settings.catalog1Slogan || settings.catalog1Desc || settings.slogan || '')
          : selectedCatalog === 'catalog2'
            ? (settings.catalog2Slogan || settings.catalog2Desc || settings.slogan || '')
            : selectedCatalog === 'catalog3'
              ? (settings.catalog3Slogan || settings.catalog3Desc || settings.slogan || '')
              : selectedCatalog === 'catalog4'
                ? (settings.catalog4Slogan || settings.catalog4Desc || settings.slogan || '')
                : (settings.slogan || 'O sabor que você merece, a um clique de distância.');

        if (selectedCatalog) {
          const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
          if (lines.length > 0) {
            return (
              <div className="flex flex-col items-center mb-12 max-w-sm mx-auto bg-white/40 backdrop-blur-md p-5 rounded-[2rem] border border-white/20 shadow-md">
                <ul className="text-left space-y-2.5 text-xs text-black/80 font-sans font-semibold">
                  {lines.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="shrink-0 select-none mt-0.5" style={{ color: settings.primaryColor || '#865d39' }}>✦</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          }
        }

        return (
          <p className="font-medium mb-12 text-center whitespace-pre-wrap max-w-md mx-auto" style={{ color: settings.textColor || '#3f2b1b' }}>
            {text}
          </p>
        );
      })()}

      <div className="w-full max-w-2xl space-y-12">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => {
            const categoryProducts = products
              .filter(p => p.categoryId === category.id && p.isActive !== false && !p.isComboOnly)
              .sort((a, b) => {
                const orderA = typeof a.order === 'number' ? a.order : 9999;
                const orderB = typeof b.order === 'number' ? b.order : 9999;
                if (orderA !== orderB) return orderA - orderB;
                return a.title.localeCompare(b.title);
              });
            if (categoryProducts.length === 0) return null;

            return (
              <div key={category.id} className="space-y-6">
                <div className="border-b border-white/20 pb-2">
                  <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight" style={{ color: settings.categoryTextColor || settings.primaryColor }}>
                    {category.title}
                  </h2>
                </div>
                <div className="space-y-4">
                  {categoryProducts.map((product) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      onClick={(e) => {
                        // If user click is inside the cart button container, don't trigger card action
                        if ((e.target as HTMLElement).closest('.cart-button-area')) {
                          return;
                        }
                        
                        if (product.isCombo) {
                          setSelectedComboProduct(product);
                          setComboDishSelections({});
                          setComboSearchTerm('');
                          return;
                        }

                        setSelectedProductForDetails(product);
                        if (product.sizes && product.sizes.length > 0) {
                          setSelectedSize(product.sizes[0]);
                        } else {
                          setSelectedSize(null);
                        }
                      }}
                      className="glass rounded-2xl p-3.5 sm:p-4 md:p-5 flex gap-3.5 sm:gap-4 items-start sm:items-center cursor-pointer hover:shadow-md transition-all duration-300 w-full relative overflow-hidden"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-xl overflow-hidden flex-shrink-0 bg-white/50 shadow-sm border border-black/5 self-start sm:self-center">
                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 text-black flex flex-col justify-between self-stretch gap-2">
                        <div className="space-y-1">
                          {/* Tags de status: Pronta Entrega, Quantidade e Combo */}
                          {(product.trackStock || product.isCombo) && (
                            <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
                              {(product.trackStock || getDishTrackedStockInfo(product).isTracked) && (() => {
                                const available = getProductAvailableStock(product);
                                const isAvailable = available > 0;
                                return (
                                  <>
                                    <span className={cn(
                                      "text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs text-white",
                                      isAvailable ? "bg-[#00753A]" : "bg-red-600"
                                    )}>
                                      {isAvailable ? "Pronta Entrega" : "Esgotado"}
                                    </span>
                                    {isAvailable ? (
                                      <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef9c3] text-[#854d0e] border border-[#fde047] whitespace-nowrap shadow-2xs">
                                        {available} {available === 1 ? 'unidade' : 'unidades'}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 whitespace-nowrap shadow-2xs">
                                        Esgotado
                                      </span>
                                    )}
                                  </>
                                );
                              })()}
                              {product.isCombo && (
                                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-950 border border-amber-500/30 whitespace-nowrap shadow-2xs">
                                  🍱 Combo {product.comboQuantity || 5} marmitas
                                </span>
                              )}
                            </div>
                          )}

                          <h3 className="text-sm sm:text-base md:text-lg font-serif font-bold text-black leading-snug">
                            {product.title}
                          </h3>
                          {product.description && (
                            <p className="text-[11px] sm:text-xs text-black/75 leading-relaxed line-clamp-2">
                              {product.description}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (product.isCombo) {
                                setSelectedComboProduct(product);
                                setComboDishSelections({});
                                setComboSearchTerm('');
                                return;
                              }
                              setSelectedProductForDetails(product);
                              if (product.sizes && product.sizes.length > 0) {
                                setSelectedSize(product.sizes[0]);
                              } else {
                                setSelectedSize(null);
                              }
                            }}
                            className="text-[11px] uppercase tracking-wider font-extrabold underline block transition-all focus:outline-none cursor-pointer hover:opacity-80 pt-0.5 text-left"
                            style={{ color: settings.primaryColor }}
                          >
                            {product.isCombo
                              ? `Montar Combo (${product.comboQuantity || 5} marmitas)`
                              : 'Ver Detalhes'}
                          </button>
                        </div>

                        {/* Bottom Row: Price on left, Action Button on right */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/5 mt-auto">
                          <div className="flex flex-col items-start">
                            {(product.isCustomCake || product.priceType === 'consult') ? (
                              <span className="text-[9px] sm:text-[10px] uppercase font-serif font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-950 border border-amber-500/20">
                                {'A Consultar'}
                              </span>
                            ) : product.sizes && product.sizes.length > 0 ? (
                              <p className="text-xs sm:text-base font-bold" style={{ color: settings.primaryColor }}>
                                A partir de {currencySymbol}{Math.min(...product.sizes.map(s => s.price)).toFixed(2)}
                              </p>
                            ) : ((product.price && product.price > 0) || (product.oldPrice && product.oldPrice > 0)) ? (
                              <div className="flex items-baseline gap-1.5">
                                {Boolean(product.price && product.price > 0 && product.oldPrice && product.oldPrice > 0) && (
                                  <span className="text-[10px] sm:text-xs line-through opacity-40">
                                    {currencySymbol}{product.oldPrice.toFixed(2)}
                                  </span>
                                )}
                                <p className="text-sm sm:text-base font-black font-serif" style={{ color: settings.primaryColor }}>
                                  {currencySymbol}{(product.price && product.price > 0 ? product.price : product.oldPrice).toFixed(2)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-[9px] sm:text-[10px] uppercase font-serif font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-950 border border-amber-500/20">
                                {'A Consultar'}
                              </span>
                            )}
                          </div>

                          <div className="flex-shrink-0 flex items-center justify-end cart-button-area pl-1 z-10">
                            {(() => {
                              if (getDishTrackedStockInfo(product).isTracked && getProductAvailableStock(product) <= 0) {
                                return (
                                  <span className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-400 font-bold text-[11px] border border-gray-200 select-none shadow-2xs">
                                    Esgotado
                                  </span>
                                );
                              }

                              if (product.isCombo) {
                                return (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedComboProduct(product);
                                      setComboDishSelections({});
                                      setComboSearchTerm('');
                                    }}
                                    className="px-3.5 py-1.5 rounded-full shadow-md font-bold text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 focus:outline-none"
                                    style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                                  >
                                    <Plus size={14} />
                                    <span>Montar Combo</span>
                                  </button>
                                );
                              }

                              const requiresCustomization = !!((product.sizes && product.sizes.length > 0) || product.isCustomCake || product.isMeal);
                              const totalQty = cart.filter(item => item.productId === product.id).reduce((sum, item) => sum + item.quantity, 0);

                              if (requiresCustomization) {
                                if (totalQty > 0) {
                                  return (
                                    <div className="flex items-center gap-1 bg-white/75 backdrop-blur-sm p-1 rounded-full border border-black/10 shadow-md">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const productCartItems = cart.filter(item => item.productId === product.id);
                                          if (productCartItems.length > 0) {
                                            const lastItem = productCartItems[productCartItems.length - 1];
                                            removeFromCart(lastItem.id);
                                          }
                                        }}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-sm border border-gray-200 cursor-pointer active:scale-95 transition-all text-black focus:outline-none"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="font-bold text-xs sm:text-sm min-w-[14px] sm:min-w-[20px] text-center text-black">
                                        {totalQty}
                                      </span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedProductForDetails(product);
                                          if (product.sizes && product.sizes.length > 0) {
                                            setSelectedSize(product.sizes[0]);
                                          } else {
                                            setSelectedSize(null);
                                          }
                                        }}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition-all focus:outline-none"
                                        style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedProductForDetails(product);
                                        if (product.sizes && product.sizes.length > 0) {
                                          setSelectedSize(product.sizes[0]);
                                        } else {
                                          setSelectedSize(null);
                                        }
                                      }}
                                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-lg font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center focus:outline-none"
                                      style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                                    >
                                      <Plus size={16} />
                                    </button>
                                  );
                                }
                              } else {
                                if (totalQty > 0) {
                                  return (
                                    <div className="flex items-center gap-1 bg-white/75 backdrop-blur-sm p-1 rounded-full border border-black/10 shadow-md">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const item = cart.find(i => i.productId === product.id);
                                          if (item) removeFromCart(item.id);
                                        }}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center shadow-sm border border-gray-200 cursor-pointer active:scale-95 transition-all text-black focus:outline-none"
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="font-bold text-xs sm:text-sm min-w-[14px] sm:min-w-[20px] text-center text-black">
                                        {totalQty}
                                      </span>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToCart(product);
                                        }}
                                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-md cursor-pointer active:scale-95 transition-all focus:outline-none"
                                        style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToCart(product);
                                      }}
                                      className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-lg font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center focus:outline-none"
                                      style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                                    >
                                      <Plus size={16} />
                                    </button>
                                  );
                                }
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center p-12 opacity-60 glass rounded-2xl">
            {'Nenhum produto encontrado.'}
          </div>
        )}
      </div>

      {(selectedCatalog === 'catalog1' || selectedCatalog === 'catalog2' || !selectedCatalog) && 
       (settings?.showStorageInstructionsButton !== false || settings?.showCustomDietButton !== false || settings?.showDetoxInstructionsButton !== false) && (
        <div className="w-full flex flex-col items-center mt-28 mb-16 gap-16 relative">
          {/* Button 1: COMO ARMAZENAR E COMO AQUECER */}
          {settings?.showStorageInstructionsButton !== false && (
            <div className="flex flex-col items-center relative">
              <div className="absolute -top-7 z-10 flex flex-col items-center animate-bounce" style={{ animationDuration: '3s' }}>
                <div className="bg-[#f09249] text-white w-[34px] h-[34px] rounded-xl text-sm font-black shadow-md relative flex items-center justify-center border border-white/20">
                  ?
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#f09249] rotate-45 border-r border-b border-white/20" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsStorageModalOpen(true)}
                className="px-8 py-4 rounded-full font-bold text-xs sm:text-sm tracking-wider uppercase text-white hover:opacity-95 active:scale-95 transition-all cursor-pointer shadow-lg border-0 text-center flex items-center justify-center min-h-[44px]"
                style={{ backgroundColor: '#725b81' }}
              >
                {'Como armazenar e como aquecer'}
              </motion.button>
            </div>
          )}

          {/* Button 2: DIETA PERSONALIZADA */}
          {settings?.showCustomDietButton !== false && (
            <div className="flex flex-col items-center relative">
              <div className="absolute -top-7 z-10 flex flex-col items-center animate-bounce" style={{ animationDuration: '3s', animationDelay: '0.7s' }}>
                <div className="bg-[#f09249] text-white w-[34px] h-[34px] rounded-xl text-sm font-black shadow-md relative flex items-center justify-center border border-white/20">
                  ?
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#f09249] rotate-45 border-r border-b border-white/20" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsCustomDietModalOpen(true)}
                className="px-8 py-4 rounded-full font-bold text-xs sm:text-sm tracking-wider uppercase text-white hover:opacity-95 active:scale-95 transition-all cursor-pointer shadow-lg border-0 text-center flex items-center justify-center min-h-[44px]"
                style={{ backgroundColor: '#00753A' }}
              >
                {'Dieta Personalizada'}
              </motion.button>
            </div>
          )}

          {/* Button 3: INSTRUÇÕES KIT DETOX */}
          {settings?.showDetoxInstructionsButton !== false && (
            <div className="flex flex-col items-center relative">
              <div className="absolute -top-7 z-10 flex flex-col items-center animate-bounce" style={{ animationDuration: '3s', animationDelay: '1.5s' }}>
                <div className="bg-[#f09249] text-white w-[34px] h-[34px] rounded-xl text-sm font-black shadow-md relative flex items-center justify-center border border-white/20">
                  ?
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#f09249] rotate-45 border-r border-b border-white/20" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setIsDetoxModalOpen(true)}
                className="px-8 py-4 rounded-full font-bold text-xs sm:text-sm tracking-wider uppercase text-white hover:opacity-95 active:scale-95 transition-all cursor-pointer shadow-lg border-0 text-center flex items-center justify-center min-h-[44px]"
                style={{ backgroundColor: '#4b6757' }}
              >
                {'Instruções Kit Detox'}
              </motion.button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isStorageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsStorageModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
            >
              {/* Header with Close button */}
              <div className="p-4 border-b border-gray-200/50 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-sans">
                  {'Como armazenar e como aquecer'}
                </h3>
                <button 
                  onClick={() => setIsStorageModalOpen(false)} 
                  className="p-2 hover:bg-gray-200/50 active:scale-90 transition-all rounded-full cursor-pointer text-gray-500 hover:text-black flex items-center justify-center min-w-[44px] min-h-[44px]"
                  aria-label="Fechar"
                >
                  <X size={24} />
                </button>
              </div>
              
              {/* Image Content */}
              <div className="p-4 overflow-y-auto flex items-center justify-center bg-gray-50">
                <img 
                  src={settings?.storageInstructionsImage || "https://i.ibb.co/TxBv7fMY/Gemini-Generated-Image-j316rpj316rpj316.jpg"} 
                  alt={'Como armazenar e como aquecer'} 
                  className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-md border border-gray-100"
                  referrerPolicy="no-referrer"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartItemsCount > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-40"
          >
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full h-16 rounded-2xl shadow-2xl flex items-center justify-between px-6 font-bold text-lg transition-transform active:scale-95 cursor-pointer"
              style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
            >
              <div className="flex items-center gap-3 font-serif">
                <ShoppingBag size={24} />
                <span>Ver Pedido</span>
              </div>
              <div className="flex items-center gap-2 font-serif text-sm">
                <span className="bg-white/20 px-2.5 py-1 rounded-full">{cartItemsCount} {cartItemsCount === 1 ? 'item' : 'itens'}</span>
                <span>{currencySymbol}{cartTotal.toFixed(2)}</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsModalOpen(false);
                setCheckoutStep('summary');
              }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] force-dark-headings"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold" style={{ color: '#000000' }}>
                  {checkoutStep === 'summary' ? t.cartTitle : t.finish}
                </h2>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setCheckoutStep('summary');
                  }} 
                  className="p-2 hover:bg-gray-100 rounded-full"
                  style={{ color: '#000000' }}
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {checkoutStep === 'summary' ? (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      {cart.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) return null;
                        return (
                          <div key={item.id} className="bg-white/50 p-3.5 rounded-2xl border border-white/30 w-full shadow-sm space-y-2.5">
                            {/* Top row: Image + Full width Title and Badges */}
                            <div className="flex items-start gap-3 w-full">
                              <img 
                                src={product.image} 
                                alt={product.title} 
                                className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-white/60 border border-black/5" 
                                referrerPolicy="no-referrer"
                              />
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-black leading-snug break-words">
                                  {product.title}
                                </h4>
                                {product.trackStock && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs text-white bg-[#00753A]">
                                      Pronta Entrega
                                    </span>
                                  </div>
                                )}
                                
                                {item.selectedSize && (
                                  <div className="mt-1">
                                    <span className="inline-block bg-[#ffedd5] text-[#7c2d12] text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md leading-tight border border-[#fed7aa] max-w-fit break-words">
                                      {item.selectedSize.name}
                                    </span>
                                  </div>
                                )}

                                {item.mealOptions && (
                                  <div className="text-[10px] leading-tight mt-1 text-black/60 break-words">
                                    {item.mealOptions.removals.length > 0 && `Sem: ${item.mealOptions.removals.join(', ')}`}
                                    {item.mealOptions.removals.length > 0 && item.mealOptions.sides.length > 0 && ' • '}
                                    {item.mealOptions.sides.length > 0 && (() => {
                                      const normalSidesArr = item.mealOptions.sides.filter(s => s.type !== 'swap');
                                      const swapSidesArr = item.mealOptions.sides.filter(s => s.type === 'swap');
                                      
                                      const formatter = (arr: any[]) => Object.entries(arr.reduce((acc: Record<string, number>, s) => { 
                                        acc[s.name] = (acc[s.name] || 0) + 1; 
                                        return acc; 
                                      }, {})).map(([name, qty]) => `${name}${Number(qty) > 1 ? ` (${qty}x)` : ''}`).join(', ');

                                      const listParts = [];
                                      if (normalSidesArr.length > 0) {
                                        listParts.push(`Acompanhamentos: ${formatter(normalSidesArr)}`);
                                      }
                                      if (swapSidesArr.length > 0) {
                                        listParts.push(`Trocas: ${formatter(swapSidesArr)}`);
                                      }
                                      return listParts.join(' • ');
                                    })()}
                                  </div>
                                )}

                                {item.cakeOptions && (
                                  <div className="text-[10px] leading-tight mt-1 space-y-0.5 text-black/60 break-words">
                                    {item.cakeOptions.size && (
                                      <div>Tamanho: <span className="font-bold text-black">{item.cakeOptions.size}</span></div>
                                    )}
                                    {item.cakeOptions.dough && (
                                      <div>Massa: <span className="font-bold text-black">{item.cakeOptions.dough}</span></div>
                                    )}
                                    {item.cakeOptions.fillings && item.cakeOptions.fillings.length > 0 && (
                                      <div>Recheio: <span className="font-bold text-black">{item.cakeOptions.fillings.join(' + ')}</span></div>
                                    )}
                                    {item.cakeOptions.topping && (
                                      <div>Cobertura: <span className="font-bold text-black">{item.cakeOptions.topping}</span></div>
                                    )}
                                    {item.cakeOptions.topper && (
                                      <div>Topo: <span className="font-bold text-black">{item.cakeOptions.topper}</span></div>
                                    )}
                                    {item.cakeOptions.styleNumber && (
                                      <div>Referência: <span className="font-bold text-black">Foto nº {item.cakeOptions.styleNumber}</span></div>
                                    )}
                                  </div>
                                )}
                                {item.sandwichOptions && (
                                  <div className="text-[10px] leading-tight mt-1 space-y-0.5 text-black/60 break-words">
                                    {item.sandwichOptions.fillings && item.sandwichOptions.fillings.length > 0 && (
                                      <div>Estado: <span className="font-bold text-black">{item.sandwichOptions.fillings.join(' + ')}</span></div>
                                    )}
                                  </div>
                                )}
                                {item.comboOptions && item.comboOptions.items.length > 0 && (
                                  <div className="text-[10px] leading-tight mt-1.5 p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 text-black/80 break-words space-y-1">
                                    <span className="font-black text-amber-950 uppercase text-[9px] block">
                                      Sabores Escolhidos:
                                    </span>
                                    <ul className="space-y-0.5">
                                      {item.comboOptions.items.map((sub, sIdx) => {
                                        const subProd = products.find(p => p.id === sub.productId);
                                        return (
                                          <li key={sIdx} className="font-medium text-black flex items-center justify-between text-[11px]">
                                            <span className="flex items-center gap-1.5 truncate">
                                              <span>• <span className="font-bold">{sub.quantity}x</span> {sub.productTitle}</span>
                                              {(subProd?.trackStock || (subProd && getDishTrackedStockInfo(subProd).isTracked)) && (
                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-[#00753A] text-white shadow-2xs shrink-0">
                                                  Pronta Entrega
                                                </span>
                                              )}
                                            </span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Bottom row: Price and Stepper controls */}
                            <div className="flex items-center justify-between pt-1.5 border-t border-black/5">
                              <div>
                                {(product.isCustomCake || product.priceType === 'consult') ? (
                                  <span className="text-[10px] uppercase font-serif font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-950 border border-amber-500/20">
                                    {'A Consultar'}
                                  </span>
                                ) : item.selectedSize ? (
                                  <div className="flex items-baseline gap-1.5">
                                    {Boolean(item.selectedSize.oldPrice && item.selectedSize.oldPrice > 0) && (
                                      <span className="text-[10px] line-through opacity-40">
                                        {currencySymbol}{item.selectedSize.oldPrice.toFixed(2)}
                                      </span>
                                    )}
                                    <p className="text-sm font-bold text-black">
                                      {currencySymbol}{((item.selectedSize.price + (item.mealOptions?.sides.reduce((sum, s) => sum + s.price, 0) || 0)) * item.quantity).toFixed(2)}
                                    </p>
                                  </div>
                                ) : ((product.price && product.price > 0) || (product.oldPrice && product.oldPrice > 0)) ? (
                                  <div className="flex items-baseline gap-1.5">
                                    {Boolean(product.price && product.price > 0 && product.oldPrice && product.oldPrice > 0) && (
                                      <span className="text-[10px] line-through opacity-40">
                                        {currencySymbol}{product.oldPrice.toFixed(2)}
                                      </span>
                                    )}
                                    <p className="text-sm font-bold text-black">
                                      {currencySymbol}{(((product.price && product.price > 0 ? product.price : product.oldPrice) + (item.mealOptions?.sides.reduce((sum, s) => sum + s.price, 0) || 0)) * item.quantity).toFixed(2)}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-[10px] uppercase font-serif font-black tracking-wider px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-950 border border-amber-500/20">
                                    {'A Consultar'}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button 
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center opacity-90 shadow-sm border border-gray-200 active:scale-95 transition-all cursor-pointer select-none"
                                >
                                  <Minus size={14} style={{ color: '#000000' }} />
                                </button>
                                <span className="font-bold text-sm text-black min-w-[18px] text-center">{item.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => {
                                    if (item.comboOptions?.items && item.comboOptions.items.length > 0) {
                                      for (const sub of item.comboOptions.items) {
                                        const subProd = products.find(p => p.id === sub.productId);
                                        if (subProd && subProd.trackStock) {
                                          const currentTotal = getProductTotalInCart(sub.productId);
                                          const additionalNeeded = Number(sub.quantity) || 1;
                                          const available = typeof subProd.stockQuantity === 'number' ? subProd.stockQuantity : 0;
                                          if (currentTotal + additionalNeeded > available) {
                                            toast.error(`Limite de estoque atingido para "${subProd.title}" (${available} un disponíveis).`);
                                            return;
                                          }
                                        }
                                      }
                                    } else if (product && product.trackStock) {
                                      const currentTotalForProduct = getProductTotalInCart(product.id);
                                      const available = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0;
                                      if (currentTotalForProduct >= available) {
                                        toast.error(`Limite de estoque atingido (${available} un disponíveis).`);
                                        return;
                                      }
                                    }
                                    setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm font-bold active:scale-95 transition-all cursor-pointer select-none"
                                  style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <div className="pt-4 border-t border-gray-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold" style={{ color: '#000000' }}>{t.total}</span>
                        <span className="text-2xl font-bold" style={{ color: '#000000' }}>
                          {currencySymbol}{cartTotal.toFixed(2)}
                        </span>
                      </div>
                      {cart.some(item => {
                        const p = products.find(prod => prod.id === item.productId);
                        return p?.priceType === 'consult' || p?.isCustomCake === true;
                      }) && (
                        <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-100 text-[10px] text-yellow-800 font-medium">
                          {t.consultMessage}
                        </div>
                      )}
                    </div>

                    {/* Alerta e Progresso de Pedido Mínimo */}
                    {settings.minOrderValue && settings.minOrderValue > 0 && cartTotal < settings.minOrderValue && (() => {
                      const minVal = Number(settings.minOrderValue);
                      const remaining = Math.max(0, minVal - cartTotal);
                      const pct = Math.min(100, Math.round((cartTotal / minVal) * 100));

                      return (
                        <div className="p-4 rounded-2xl border-2 border-amber-300/80 bg-amber-50/70 space-y-2.5 text-left shadow-2xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wide text-amber-950 font-serif">
                              PEDIDO MÍNIMO: {currencySymbol} {minVal.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300 text-[11px] font-bold shadow-2xs whitespace-nowrap">
                              🚚 Pedido Mínimo
                            </span>
                          </div>

                          <p className="text-xs text-amber-900 font-medium leading-relaxed">
                            O valor mínimo para realizar o pedido é de {currencySymbol} {minVal.toFixed(2).replace('.', ',')}.
                          </p>

                          <div className="w-full h-2.5 bg-amber-200/80 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-500 to-amber-600 transition-all duration-300 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs font-bold text-amber-950 pt-0.5">
                            <span>Faltam para o mínimo: {currencySymbol} {remaining.toFixed(2).replace('.', ',')}</span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                      );
                    })()}

                    {(() => {
                      const validation = validateCartItems();
                      if (!validation.isValid) {
                        return (
                          <div className="p-3 mb-2 rounded-xl bg-red-50 border border-red-100 text-[11px] text-red-800 font-bold flex items-start gap-1.5 leading-relaxed text-left">
                            <span>⚠️</span>
                            <span>{validation.message}</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {settings.minOrderValue && settings.minOrderValue > 0 && cartTotal < settings.minOrderValue ? (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled
                          className="w-full py-4 rounded-xl font-bold text-sm sm:text-base bg-[#e2e8f0]/90 text-slate-500 border border-slate-300 cursor-not-allowed flex items-center justify-center gap-2 shadow-xs select-none"
                        >
                          <span>
                            🔒 Mínimo {currencySymbol} {Number(settings.minOrderValue).toFixed(2).replace('.', ',')} (Faltam {currencySymbol} {(Number(settings.minOrderValue) - cartTotal).toFixed(2).replace('.', ',')})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false);
                            setCheckoutStep('summary');
                          }}
                          className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-[#393e36] hover:bg-[#2c312a] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <span>+ Adicionar mais refeições do cardápio</span>
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          const validation = validateCartItems();
                          if (!validation.isValid) {
                            toast.error(validation.message);
                            return;
                          }
                          if (settings?.minOrderValue && settings.minOrderValue > 0 && cartTotal < settings.minOrderValue) {
                            toast.error(`O valor mínimo para realizar o pedido é de ${currencySymbol} ${settings.minOrderValue.toFixed(2).replace('.', ',')}.`);
                            return;
                          }
                          if (checkMarmitifyLimit()) {
                            setCheckoutStep('form');
                          }
                        }}
                        className="w-full py-4 rounded-xl font-bold text-lg shadow-xl transition-transform active:scale-95 cursor-pointer"
                        style={{ backgroundColor: settings.primaryColor, color: getContrastText(settings.primaryColor) }}
                      >
                        {t.next}
                      </button>
                    )}
                  </div>
                ) : checkoutStep === 'channels' ? (
                  <div className="space-y-6 text-center py-4 font-sans text-black animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-1">
                      <Check size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-black uppercase tracking-wide text-black">
                        PEDIDO SALVO!
                      </h3>
                      <p className="text-xs font-semibold text-black/60 max-w-sm mx-auto">
                        Os detalhes do seu pedido foram registrados com sucesso.
                      </p>
                    </div>

                    {!hasRedirected ? (
                      <>
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-950 font-medium text-xs font-sans text-left leading-relaxed">
                          Para concluir o seu pedido e receber uma cópia dele, clique no botão abaixo
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const url = standardSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                              setHasRedirected(true);
                            }}
                            className="flex items-center justify-center w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <span>Enviar Pedido por WhatsApp</span>
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            setCheckoutStep('form');
                            setStandardSuccessUrls(null);
                          }}
                          className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-4 uppercase tracking-wider block mx-auto cursor-pointer"
                        >
                          Voltar para os detalhes
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-950 font-medium text-xs font-sans text-left leading-relaxed space-y-2">
                          <p className="font-bold text-sm text-green-800">Seu pedido foi direcionado ao WhatsApp!</p>
                          <p>Se o chat abriu corretamente e você já enviou a mensagem, você pode concluir e limpar o seu carrinho de compras agora.</p>
                          <p className="text-amber-700">Se por acaso o número do WhatsApp estiver incorreto ou houver algum outro problema, clique em "Voltar e Ajustar" para tentar novamente sem perder os dados!</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleCompleteStandardOrder();
                            }}
                            className="flex items-center justify-center w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <span>Sim, Limpar Carrinho e Concluir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = standardSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                            }}
                            className="flex items-center justify-center w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold font-sans text-xs shadow-sm transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <span>Tentar Enviar Novamente</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => {
                              setHasRedirected(false);
                            }}
                            className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-2 uppercase tracking-wider block mx-auto cursor-pointer"
                          >
                            Voltar e Ajustar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : checkoutStep === 'b2b_channels' ? (
                  <div className="space-y-6 text-center py-4 font-sans text-black animate-fade-in">
                    <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-1">
                      <Check size={36} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-xl font-serif font-black uppercase tracking-wide text-black">
                        PEDIDO SALVO!
                      </h3>
                      <p className="text-xs font-semibold text-black/60 max-w-sm mx-auto">
                        Os detalhes do seu pedido corporativo foram registrados com sucesso.
                      </p>
                    </div>

                    {!hasRedirected ? (
                      <>
                        <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-amber-950 font-medium text-xs font-sans text-left leading-relaxed">
                          Para concluir o seu pedido e receber uma cópia dele, clique no botão abaixo
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const url = b2bSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                              setHasRedirected(true);
                            }}
                            className="flex items-center justify-center w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <span>Enviar Pedido por WhatsApp</span>
                          </button>
                        </div>

                        <button 
                          type="button"
                          onClick={() => {
                            setCheckoutStep('form');
                            setB2bSuccessUrls(null);
                          }}
                          className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-4 uppercase tracking-wider block mx-auto cursor-pointer"
                        >
                          Voltar para os detalhes
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-950 font-medium text-xs font-sans text-left leading-relaxed space-y-2">
                          <p className="font-bold text-sm text-green-800">Seu pedido foi direcionado ao WhatsApp!</p>
                          <p>Se o chat abriu corretamente e você já enviou a mensagem, você pode concluir e limpar o seu carrinho corporativo de compras agora.</p>
                          <p className="text-amber-700">Se por acaso o número do WhatsApp estiver incorreto ou houver algum outro problema, clique em "Voltar e Ajustar" para tentar novamente sem perder os dados!</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              handleCompleteB2bOrder();
                            }}
                            className="flex items-center justify-center w-full py-4 px-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold font-sans text-sm shadow-md transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <span>Sim, Limpar Carrinho e Concluir</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const url = b2bSuccessUrls?.whatsapp || '#';
                              try {
                                const win = window.open(url, '_blank');
                                if (!win || win.closed || typeof win.closed === 'undefined') {
                                  window.location.href = url;
                                }
                              } catch (e) {
                                window.location.href = url;
                              }
                            }}
                            className="flex items-center justify-center w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold font-sans text-xs shadow-sm transition-all active:scale-95 cursor-pointer border-0 text-center"
                          >
                            <span>Tentar Enviar Novamente</span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => {
                              setHasRedirected(false);
                            }}
                            className="text-xs font-bold text-gray-500 hover:text-black hover:underline mt-2 uppercase tracking-wider block mx-auto cursor-pointer"
                          >
                            Voltar e Ajustar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : false ? (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-serif font-black uppercase tracking-wide" style={{ color: settings.primaryColor }}>
                        Dados do Pedido Corporativo
                      </h3>
                      <p className="text-xs font-semibold text-black/60 font-sans max-w-sm mx-auto">
                        Informe os dados da sua empresa para enviar o pedido.
                      </p>
                    </div>

                    {isReturningB2b && (
                      <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-950 flex flex-col gap-1.5 font-sans">
                        <p className="text-xs font-bold flex items-center gap-1.5 text-teal-800">
                          <span className="flex h-2.5 w-2.5 rounded-full bg-teal-500 animate-pulse" />
                          Conta Corporativa Salva
                        </p>
                        <p className="text-[10px] opacity-90 leading-tight font-medium">
                          Seus dados estão salvos neste dispositivo. Revise-os abaixo ou limpe para novos dados.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem('b2b_profile_save');
                            setB2bName('');
                            setB2bResponsibleName('');
                            setB2bPhone('');
                            setB2bAddress('');
                            setIsReturningB2b(false);
                            toast.success('Campos limpos com sucesso!');
                          }}
                          className="self-start text-[9px] uppercase tracking-wider font-extrabold text-red-700 hover:underline mt-1 bg-white border border-red-200 px-2 py-1 rounded-lg border-0 cursor-pointer"
                        >
                          Limpar Dados Salvos
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleFinalizarB2b} className="space-y-4">
                      {/* Company Name */}
                      <div className="space-y-1 relative">
                        <label className="text-xs font-bold uppercase text-black">Razão Social / Nome da Empresa *</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={b2bName}
                          onChange={e => {
                            const val = e.target.value;
                            setB2bName(val);
                            if (val.trim().length > 1) {
                              const matched = b2bProfiles.filter(p => 
                                p.name.toLowerCase().includes(val.toLowerCase())
                              );
                              setB2bSearchResults(matched);
                              setShowB2bSearchDropdown(matched.length > 0);
                            } else {
                              setShowB2bSearchDropdown(false);
                            }
                          }}
                        />
                        {showB2bSearchDropdown && b2bSearchResults.length > 0 && (
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {b2bSearchResults.map((profile, i) => (
                              <button
                                key={i}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-xs font-semibold text-gray-800 border-b border-gray-50 last:border-b-0 border-0 cursor-pointer"
                                onClick={() => {
                                  setB2bName(profile.name);
                                  setB2bResponsibleName(profile.manager || '');
                                  setB2bPhone(profile.phone || '');
                                  setB2bAddress(profile.address || '');
                                  setShowB2bSearchDropdown(false);
                                }}
                              >
                                {profile.name} (Responsável: {profile.manager})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Responsible names */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Responsável / Gestor do Contato *</label>
                          <input 
                            required
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bResponsibleName}
                            onChange={e => setB2bResponsibleName(e.target.value)}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Telefone / WhatsApp Comercial *</label>
                          <input 
                            required
                            type="tel" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bPhone}
                            onChange={e => setB2bPhone(formatBRPhone(e.target.value))}
                            placeholder="(99) 99999-9999"
                          />
                        </div>
                      </div>

                      {/* Commercial Address */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">Endereço Comercial de Entrega *</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Rua, Número, Sala/Complemento, Bairro..."
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={b2bAddress}
                          onChange={e => setB2bAddress(e.target.value)}
                        />
                      </div>

                      {/* Zip Code and Cidade */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">CEP *</label>
                          <input 
                            required
                            type="text" 
                            placeholder="CEP"
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bZipCode}
                            onChange={e => setB2bZipCode(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Cidade *</label>
                          <input 
                            required
                            type="text" 
                            placeholder="Cidade"
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bCity}
                            onChange={e => setB2bCity(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Plan and Date */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase text-black block">Frequência Desejada do Pedido *</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setB2bFrequency('one-time')}
                              className={cn(
                                "py-2.5 px-3 rounded-xl font-bold font-sans text-xs border text-center transition-all cursor-pointer",
                                b2bFrequency === 'one-time'
                                  ? "bg-black text-white border-black"
                                  : "bg-white text-black border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              Pedido Avulso
                            </button>
                            <button
                              type="button"
                              onClick={() => setB2bFrequency('weekly')}
                              className={cn(
                                "py-2.5 px-3 rounded-xl font-bold font-sans text-xs border text-center transition-all cursor-pointer",
                                b2bFrequency === 'weekly'
                                  ? "bg-black text-white border-black"
                                  : "bg-white text-black border-gray-300 hover:bg-gray-50"
                              )}
                            >
                              Plano Semanal (Recorrente)
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">Data Desejada de Entrega *</label>
                          <input 
                            required
                            type="date" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-sans font-semibold"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={b2bDate}
                            onChange={e => setB2bDate(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Observations */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">Instruções Especiais / Observações de Recebimento</label>
                        <textarea 
                          rows={2}
                          placeholder="Ex: Horários preferenciais de recebimento, doca de carga ou detalhes de faturamento..."
                          className="w-full p-2.5 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black text-xs font-semibold"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={b2bObservation}
                          onChange={e => setB2bObservation(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button 
                          type="button"
                          onClick={() => setCheckoutStep('summary')}
                          className="px-6 py-4 rounded-xl bg-white border border-gray-200 text-black font-bold cursor-pointer font-serif border-0 hover:bg-gray-50 transition-colors"
                        >
                          {t.back}
                        </button>
                        <button 
                          type="submit"
                          className="flex-grow py-4 rounded-xl font-bold text-lg shadow-xl transition-transform active:scale-95 cursor-pointer font-serif border-0"
                          style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                        >
                          Enviar Pedido Corporativo
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-serif font-bold" style={{ color: '#000000' }}>{t.orderDetails}</h3>
                      {settings.checkoutTitle && (
                        <p className="text-sm font-medium italic leading-relaxed px-4" style={{ color: '#000000' }}>
                          {settings.checkoutTitle}
                        </p>
                      )}
                    </div>

                    {(settings.infoBlock1Title || settings.infoBlock1Text || settings.infoBlock2Title || settings.infoBlock2Text) && (
                      <div className="grid grid-cols-1 gap-3">
                        {settings.infoBlock1Title && (
                          <div className="bg-white/50 p-4 rounded-2xl border border-white/20 shadow-sm">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#000000' }}>{settings.infoBlock1Title}</h4>
                            <p className="text-[10px] leading-relaxed" style={{ color: '#000000' }}>{settings.infoBlock1Text}</p>
                          </div>
                        )}
                        {settings.infoBlock2Title && (
                          <div className="bg-white/50 p-4 rounded-2xl border border-white/20 shadow-sm">
                            <h4 className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#000000' }}>{settings.infoBlock2Title}</h4>
                            <p className="text-[10px] leading-relaxed" style={{ color: '#000000' }}>{settings.infoBlock2Text}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleFinalizar} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">{t.fullName}</label>
                        <input 
                          required
                          type="text" 
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={formData.nome}
                          onChange={e => setFormData({...formData, nome: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black flex items-center gap-1">
                            {t.phone} <span className="text-green-600 font-extrabold text-[10px] bg-green-50 px-1.5 py-0.5 rounded border border-green-200">BR (+55)</span>
                          </label>
                          <div className="relative flex items-center">
                            <span className="absolute left-3 text-xs font-extrabold text-green-700 bg-green-50 px-1 rounded pointer-events-none select-none">+55</span>
                            <input 
                              required
                              type="tel" 
                              className="w-full p-3 pl-12 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black font-semibold"
                              style={{ '--tw-ring-color': settings.primaryColor } as any}
                              value={formData.telefone}
                              onChange={e => setFormData({...formData, telefone: formatBRPhone(e.target.value)})}
                              placeholder="(99) 99999-9999"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">
                            {t.birthday}
                          </label>
                          <input 
                            required
                            type="text" 
                            placeholder={t.birthdayPlaceholder}
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={formData.aniversario}
                            onChange={e => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length > 4) val = val.slice(0, 4);
                              if (val.length > 2) {
                                val = val.slice(0, 2) + '/' + val.slice(2);
                              }
                              setFormData({...formData, aniversario: val});
                            }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">{t.email}</label>
                        <input 
                          required
                          type="email" 
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                      </div>

                      {/* Bairro para Entrega e Taxa de Entrega */}
                      {settings.deliveryNeighborhoods && settings.deliveryNeighborhoods.length > 0 && (
                        <div className="space-y-1.5 p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <label className="text-xs font-bold uppercase text-blue-950 flex items-center gap-1.5">
                              <MapPin size={14} className="text-blue-600" />
                              <span>Bairro para Entrega *</span>
                            </label>
                            {formData.deliveryNeighborhoodId && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                                {formData.deliveryFee > 0
                                  ? `Taxa: ${currencySymbol} ${formData.deliveryFee.toFixed(2).replace('.', ',')}`
                                  : (formData.deliveryNeighborhoodId === 'other' ? 'Taxa a combinar' : 'Entrega Grátis')}
                              </span>
                            )}
                          </div>
                          
                          <select
                            required
                            className="w-full p-3 rounded-xl border border-blue-200 bg-white focus:ring-2 outline-none text-black font-medium text-sm cursor-pointer"
                            style={{ '--tw-ring-color': settings.primaryColor || '#2563eb' } as any}
                            value={formData.deliveryNeighborhoodId}
                            onChange={e => {
                              const selId = e.target.value;
                              if (selId === 'other') {
                                setFormData(prev => ({
                                  ...prev,
                                  deliveryNeighborhoodId: 'other',
                                  deliveryNeighborhoodName: 'Outro Bairro (A combinar via WhatsApp)',
                                  deliveryFee: 0
                                }));
                              } else {
                                const found = settings.deliveryNeighborhoods?.find(n => n.id === selId);
                                if (found) {
                                  setFormData(prev => ({
                                    ...prev,
                                    deliveryNeighborhoodId: found.id,
                                    deliveryNeighborhoodName: found.name,
                                    deliveryFee: Number(found.fee || 0)
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    deliveryNeighborhoodId: '',
                                    deliveryNeighborhoodName: '',
                                    deliveryFee: 0
                                  }));
                                }
                              }
                            }}
                          >
                            <option value="">Selecione o seu bairro...</option>
                            {settings.deliveryNeighborhoods.map(n => (
                              <option key={n.id} value={n.id}>
                                {n.name} — {n.fee > 0 ? `${currencySymbol} ${n.fee.toFixed(2).replace('.', ',')}` : 'Grátis'}
                              </option>
                            ))}
                            <option value="other">Outro Bairro (Taxa a combinar via WhatsApp)</option>
                          </select>
                          <p className="text-[11px] text-blue-800/80">
                            A taxa de entrega será calculada e somada ao total final do seu pedido.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-bold uppercase text-black">{t.street}</label>
                          <input 
                            required
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={formData.street}
                            onChange={e => setFormData({...formData, street: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">{t.number}</label>
                          <input 
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={formData.number}
                            onChange={e => setFormData({...formData, number: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">{t.city}</label>
                          <input 
                            required
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={formData.city}
                            onChange={e => setFormData({...formData, city: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold uppercase text-black">{t.state}</label>
                          <input 
                            required
                            type="text" 
                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                            style={{ '--tw-ring-color': settings.primaryColor } as any}
                            value={formData.state}
                            onChange={e => setFormData({...formData, state: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-black">{t.observation}</label>
                        <textarea 
                          rows={2}
                          className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 outline-none text-black"
                          style={{ '--tw-ring-color': settings.primaryColor } as any}
                          value={formData.observacao}
                          onChange={e => setFormData({...formData, observacao: e.target.value})}
                        />
                      </div>

                      {/* Resumo Financeiro do Pedido no Checkout com Taxa Somada */}
                      <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200 space-y-2">
                        <div className="flex justify-between items-center text-sm text-gray-600">
                          <span>Subtotal dos Itens:</span>
                          <span className="font-semibold text-gray-900">{currencySymbol} {cartTotal.toFixed(2).replace('.', ',')}</span>
                        </div>
                        {formData.deliveryNeighborhoodId && (
                          <div className="flex justify-between items-center text-sm text-blue-800">
                            <span className="flex items-center gap-1 font-medium">
                              <MapPin size={13} className="text-blue-600" />
                              Taxa de Entrega ({formData.deliveryNeighborhoodName || 'Bairro'}):
                            </span>
                            <span className="font-bold">
                              {formData.deliveryFee > 0
                                ? `+ ${currencySymbol} ${Number(formData.deliveryFee).toFixed(2).replace('.', ',')}`
                                : (formData.deliveryNeighborhoodId === 'other' ? 'A combinar via WhatsApp' : 'Grátis')}
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                          <span className="font-serif font-bold text-base text-gray-900">{t.total}:</span>
                          <span className="font-serif font-extrabold text-2xl" style={{ color: settings.primaryColor || '#865d39' }}>
                            {currencySymbol} {(cartTotal + Number(formData.deliveryFee || 0)).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button 
                          type="button"
                          onClick={() => setCheckoutStep('summary')}
                          className="px-6 py-4 rounded-xl bg-white border border-gray-200 font-bold"
                          style={{ color: '#000000' }}
                        >
                          {t.back}
                        </button>
                        <button 
                          type="submit"
                          disabled={isSubmitting}
                          className={`flex-grow py-4 rounded-xl font-bold text-lg shadow-xl transition-transform active:scale-95 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                        >
                          {isSubmitting 
                            ? 'Processando...' 
                            : t.finish}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProductForDetails && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProductForDetails(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black font-sans force-dark-headings"
              style={{ '--text-color': '#000000' } as any}
            >
              {/* Close button top right overlay */}
              <button
                onClick={() => setSelectedProductForDetails(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/35 hover:bg-black/50 text-white backdrop-blur-sm rounded-full transition-all border-0 focus:outline-none cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Scrollable Container */}
              <div className="overflow-y-auto w-full flex-grow">
                {/* Hero Product Image */}
                <div className="w-full aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                  <img 
                    src={selectedProductForDetails.image} 
                    alt={selectedProductForDetails.title} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="p-6 md:p-8 space-y-6">
                  {/* Title & Stats */}
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-black leading-tight">
                      {selectedProductForDetails.title}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {selectedProductForDetails.categoryTitle && (
                        <span className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-950 rounded-lg">
                          {selectedProductForDetails.categoryTitle}
                        </span>
                      )}
                      {(selectedProductForDetails.trackStock || getDishTrackedStockInfo(selectedProductForDetails).isTracked) && (() => {
                        const available = getProductAvailableStock(selectedProductForDetails);
                        const isAvailable = available > 0;
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs text-white",
                              isAvailable ? "bg-[#00753A]" : "bg-red-600"
                            )}>
                              {isAvailable ? "Pronta Entrega" : "Esgotado"}
                            </span>
                            {isAvailable ? (
                              <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef9c3] text-[#854d0e] border border-[#fde047] whitespace-nowrap shadow-2xs">
                                {available} {available === 1 ? 'unidade' : 'unidades'}
                              </span>
                            ) : (
                              <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 whitespace-nowrap shadow-2xs">
                                Esgotado
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Pricing Display */}
                  <div className="p-4 rounded-2xl bg-white/50 border border-white/20">
                    <label className="text-[10px] font-black uppercase text-black/50 block tracking-wider mb-1">
                      Detalhes do Preço
                    </label>
                    {false ? (
                        <div className="space-y-4">
                          {selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-bold text-black/60 mb-2">
                                {'Opções Disponíveis (Selecione para adicionar):'}
                              </p>
                              <div className="space-y-2">
                              {selectedProductForDetails.sizes.map((s, idx) => {
                                const cartItem = cart.find(item => item.productId === selectedProductForDetails.id && item.selectedSize?.id === s.id && !item.mealOptions);
                                const qty = cartItem ? cartItem.quantity : 0;
                                return (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center p-3 bg-white/80 border border-gray-200/50 rounded-2xl font-bold text-black text-xs"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-black">{s.name}</span>
                                      {typeof s.price === 'number' && s.price > 0 && (
                                        <span className="text-xs text-gray-500 font-extrabold mt-0.5">
                                          {currencySymbol}{s.price.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      {qty > 0 ? (
                                        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full border border-gray-200">
                                          <button
                                            type="button"
                                            onClick={() => decrementSizeQty(selectedProductForDetails, s)}
                                            className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black shadow-sm cursor-pointer active:scale-95 transition-all focus:outline-none"
                                          >
                                            <Minus size={14} />
                                          </button>
                                          <span className="text-sm font-black min-w-[20px] text-center text-black">{qty}</span>
                                          <button
                                            type="button"
                                            onClick={() => incrementSizeQty(selectedProductForDetails, s)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all focus:outline-none"
                                            style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                          >
                                            <Plus size={14} />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => incrementSizeQty(selectedProductForDetails, s)}
                                          className="px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase shadow-md hover:scale-105 active:scale-95 cursor-pointer transition-all flex items-center gap-1 focus:outline-none"
                                          style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                        >
                                          <Plus size={12} />
                                          <span>Adicionar</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (selectedProductForDetails.isCustomCake || selectedProductForDetails.priceType === 'consult' || (!selectedProductForDetails.price && !selectedProductForDetails.oldPrice && (!selectedProductForDetails.sizes || selectedProductForDetails.sizes.length === 0))) ? (
                      <div className="space-y-1">
                        <span className="text-xl font-bold text-amber-950 block font-serif">
                          {'A Consultar'}
                        </span>
                        <p className="text-[11px] text-black/60 font-semibold leading-relaxed">
                          Personalize as especificações clicando para adicionar.
                        </p>
                      </div>
                    ) : selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-black/60 mb-2">
                          {'Opções Disponíveis (Selecione para adicionar):'}
                        </p>
                        <div className="space-y-2">
                          {selectedProductForDetails.sizes.map((s, idx) => {
                            const isSelected = selectedSize?.id === s.id;
                            const hasExclusionsOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.ingredients && selectedProductForDetails.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
                            const hasSidesOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
                            const isCustomCakeOpt = !!selectedProductForDetails.isCustomCake;
                            const isCustomSandwichOpt = !!selectedProductForDetails.isCustomSandwich;
                            const requiresCustomization = hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;

                            if (requiresCustomization) {
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSelectedSize(s);
                                    if (selectedProductForDetails.isCustomSandwich) {
                                      setSelectedSandwichFillings([]);
                                    }
                                  }}
                                  className={cn(
                                    "w-full flex justify-between items-center p-3.5 rounded-2xl font-bold text-black text-xs border-2 text-left transition-all cursor-pointer",
                                    isSelected 
                                      ? "border-blue-500 bg-white shadow-md scale-[1.01]" 
                                      : "border-gray-200/50 bg-white/80 hover:border-gray-300"
                                  )}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                      "w-4 h-4 rounded-full border flex items-center justify-center",
                                      isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-gray-300 bg-white"
                                    )}>
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-black">{s.name}</span>
                                      {s.price && s.price > 0 && (
                                        <span className="text-xs text-gray-500 font-extrabold mt-0.5">
                                          {currencySymbol}{s.price.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected && <Check size={14} className="text-blue-500" />}
                                </button>
                              );
                            }

                            const cartItem = cart.find(item => item.productId === selectedProductForDetails.id && item.selectedSize?.id === s.id && !item.mealOptions);
                            const qty = cartItem ? cartItem.quantity : 0;
                            return (
                              <div
                                key={idx}
                                className="flex justify-between items-center p-3.5 bg-white/80 border border-gray-200/50 rounded-2xl font-bold text-black text-xs"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-black">{s.name}</span>
                                  {s.price && s.price > 0 && (
                                    <span className="text-xs text-gray-500 font-extrabold mt-0.5">
                                      {currencySymbol}{s.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {qty > 0 ? (
                                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full border border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => decrementSizeQty(selectedProductForDetails, s)}
                                        className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black shadow-sm cursor-pointer active:scale-95 transition-all focus:outline-none"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="text-sm font-black min-w-[20px] text-center text-black">{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => incrementSizeQty(selectedProductForDetails, s)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all focus:outline-none"
                                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => incrementSizeQty(selectedProductForDetails, s)}
                                      className="px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase shadow-md hover:scale-105 active:scale-95 cursor-pointer transition-all flex items-center gap-1 focus:outline-none"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                    >
                                      <Plus size={12} />
                                      <span>Adicionar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-serif font-black text-black">
                          {currencySymbol}{(selectedProductForDetails.price > 0 ? selectedProductForDetails.price : (selectedProductForDetails.oldPrice || 0)).toFixed(2)}
                        </p>
                        {Boolean(selectedProductForDetails.price > 0 && selectedProductForDetails.oldPrice && selectedProductForDetails.oldPrice > 0) && (
                          <span className="text-sm line-through opacity-40">
                            {currencySymbol}{selectedProductForDetails.oldPrice.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extended Description Section */}
                  <div className="space-y-2 text-black">
                    <h3 className="text-xs font-black uppercase tracking-wider text-black/60">Descrição do Produto</h3>
                    <p className="text-sm leading-relaxed text-black/80 font-medium whitespace-pre-wrap">
                      {selectedProductForDetails.description || 'Nenhuma especificação detalhada fornecida.'}
                    </p>
                  </div>

                  {/* Tabela Nutricional */}
                  {selectedProductForDetails.nutritionalInfo && (() => {
                    const info = selectedProductForDetails.nutritionalInfo;
                    const hasNutritionalInfo = info && (
                      info.servingSize || info.servingsPerContainer ||
                      info.calories || info.carbohydrates || info.carbs || info.totalSugars || info.addedSugars ||
                      info.proteins || info.totalFat || info.saturatedFat || info.transFat || info.fiber || info.sodium
                    );
                    if (!hasNutritionalInfo) return null;

                    const hasAnyVd = Boolean(
                      info.caloriesVd || info.carbsVd || info.totalSugarsVd || info.addedSugarsVd ||
                      info.proteinsVd || info.totalFatVd || info.saturatedFatVd || info.transFatVd ||
                      info.fiberVd || info.sodiumVd
                    );
                    
                    return (
                      <div className="space-y-3 pt-4 border-t border-gray-200/40">
                        <h3 className="text-xs font-black uppercase tracking-wider text-black/60 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Tabela Nutricional
                        </h3>
                        <div className="border-2 border-black rounded-xl p-3.5 bg-white shadow-sm font-sans max-w-md mx-auto text-black">
                          <p className="text-center font-black text-base uppercase tracking-wider border-b-2 border-black pb-1">
                            Informação Nutricional
                          </p>

                          {(info.servingsPerContainer || info.servingSize) && (
                            <div className="text-[11px] font-semibold border-b border-black py-1.5 space-y-0.5 text-gray-800">
                              {info.servingsPerContainer && (
                                <p>Porções por embalagem: <span className="font-bold text-black">{info.servingsPerContainer}</span></p>
                              )}
                              {info.servingSize && (
                                <p>Porção: <span className="font-bold text-black">{info.servingSize}</span></p>
                              )}
                            </div>
                          )}

                          <div className="text-xs divide-y divide-black/15 mt-1">
                            <div className="flex justify-between items-center py-1 font-black text-[11px] border-b-2 border-black">
                              <span>Item / Nutriente</span>
                              <div className="flex items-center gap-4">
                                <span className="text-right">Qtd.</span>
                                {hasAnyVd && <span className="w-12 text-right">% VD*</span>}
                              </div>
                            </div>

                            {/* Valor Energético */}
                            {info.calories && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Valor energético (kcal)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.calories} kcal</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.caloriesVd ? `${info.caloriesVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Carboidratos */}
                            {(info.carbohydrates || info.carbs) && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Carboidratos (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.carbs || info.carbohydrates} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.carbsVd ? `${info.carbsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Açúcares Totais */}
                            {info.totalSugars && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Açúcares totais (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.totalSugars} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.totalSugarsVd ? `${info.totalSugarsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Açúcares Adicionados */}
                            {info.addedSugars && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Açúcares adicionados (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.addedSugars} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.addedSugarsVd ? `${info.addedSugarsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Proteínas */}
                            {info.proteins && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Proteínas (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.proteins} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.proteinsVd ? `${info.proteinsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Gorduras Totais */}
                            {info.totalFat && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Gorduras totais (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.totalFat} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.totalFatVd ? `${info.totalFatVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Gorduras Saturadas */}
                            {info.saturatedFat && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Gorduras saturadas (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.saturatedFat} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.saturatedFatVd ? `${info.saturatedFatVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Gorduras Trans */}
                            {info.transFat && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Gorduras trans (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.transFat} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.transFatVd ? `${info.transFatVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Fibras */}
                            {info.fiber && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Fibra alimentar (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.fiber} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.fiberVd ? `${info.fiberVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Sódio */}
                            {info.sodium && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Sódio (mg)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.sodium} mg</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.sodiumVd ? `${info.sodiumVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}
                          </div>

                          <p className="text-[9px] text-gray-500 mt-2 text-center leading-tight">
                            * Percentual de valores diários (% VD) fornecidos pela porção.
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Custom Cake Options in Details Modal */}
                  {selectedProductForDetails.isCustomCake && (
                    <div className="border-t border-gray-200/30 pt-6 space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-wider text-black/60">Personalização do Bolo</h4>
                      
                      {/* Size Selection */}
                      {cakeSizesList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-black/60">Tamanho / Fatias / Peso</p>
                          <div className="grid grid-cols-1 gap-2">
                            {cakeSizesList.map((sizeOpt, idx) => {
                              const isSelected = selectedCakeSize === sizeOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedCakeSize(sizeOpt)}
                                  className={cn(
                                    "p-3 rounded-xl border-2 transition-all flex justify-between items-center w-full text-left font-bold text-xs cursor-pointer",
                                    isSelected 
                                      ? "shadow-md scale-[1.01]" 
                                      : "bg-white border-gray-200 hover:border-gray-300 text-black"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  <span>{sizeOpt}</span>
                                  {isSelected && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Dough Selection */}
                      {cakeDoughsList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-black/60">Seleção de Massa</p>
                          <div className="grid grid-cols-2 gap-2">
                            {cakeDoughsList.map((doughOpt, idx) => {
                              const isSelected = selectedDough === doughOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedDough(doughOpt)}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all text-center text-xs font-bold w-full cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300 text-black"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {doughOpt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Fillings Selection */}
                      {cakeFillingsList.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex justify-between items-baseline">
                            <p className="text-xs font-bold text-black/60">Opções de Recheio</p>
                            <span className="text-[10px] text-gray-500 font-bold">Escolha até {settings.cakeFillingsMax || 2}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cakeFillingsList.map((fillingOpt, idx) => {
                              const isSelected = selectedFillings.includes(fillingOpt);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedFillings(selectedFillings.filter(f => f !== fillingOpt));
                                    } else {
                                      const maxFillings = settings.cakeFillingsMax || 2;
                                      if (selectedFillings.length >= maxFillings) {
                                        toast.error(`Você pode escolher no máximo ${maxFillings} recheios!`);
                                        return;
                                      }
                                      setSelectedFillings([...selectedFillings, fillingOpt]);
                                    }
                                  }}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all flex items-center justify-between font-bold text-xs cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300 text-black"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  <span>{fillingOpt}</span>
                                  {isSelected && <Check size={12} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Toppings Selection */}
                      {cakeToppingsList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-black/60">Seleção de Cobertura</p>
                          <div className="grid grid-cols-2 gap-2">
                            {cakeToppingsList.map((toppingOpt, idx) => {
                              const isSelected = selectedTopping === toppingOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTopping(toppingOpt)}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all text-center text-xs font-bold w-full cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300 text-black"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {toppingOpt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Topper Selection */}
                      {cakeToppersList.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-black/60">Topo de Bolo</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cakeToppersList.map((topperOpt, idx) => {
                              const isSelected = selectedTopper === topperOpt;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setSelectedTopper(topperOpt)}
                                  className={cn(
                                    "p-2.5 rounded-xl border-2 transition-all text-center text-xs font-bold w-full cursor-pointer",
                                    isSelected 
                                      ? "shadow-md" 
                                      : "bg-white border-gray-200 hover:border-gray-300 text-black"
                                  )}
                                  style={{ 
                                    backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {topperOpt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Style Selection Reference */}
                      {selectedProductForDetails.cakeGalleryId && (
                        (() => {
                          const associatedGallery = galleries.find(g => g.id === selectedProductForDetails.cakeGalleryId);
                          const validImages = associatedGallery?.images?.filter(img => img && img.trim() !== '') || [];
                          if (validImages.length === 0) return null;
                          
                          const noStyleText = selectedStyleNumber === null ? 'Selecionado: Base Tradicional' : 'Selecionar: Base Tradicional';

                          return (
                            <div className="space-y-3 pt-2">
                              <p className="text-xs font-bold text-black/60">Estilo do Bolo / Referência Visual</p>
                              <div className="w-full mb-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStyleNumber(null)}
                                  className={cn(
                                    "w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 border-2 cursor-pointer uppercase",
                                    selectedStyleNumber === null
                                      ? "shadow-md text-white border-transparent"
                                      : "bg-white border-gray-200 hover:border-gray-300 text-black"
                                  )}
                                  style={{
                                    backgroundColor: selectedStyleNumber === null ? (settings.primaryColor || '#865d39') : '#ffffff',
                                    color: selectedStyleNumber === null ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                    borderColor: settings.primaryColor || '#865d39'
                                  }}
                                >
                                  {selectedStyleNumber === null ? <Check size={12} /> : <X size={12} />}
                                  <span>{noStyleText}</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                {associatedGallery?.images?.map((img, idx) => {
                                  if (!img || img.trim() === '') return null;
                                  const isSelected = selectedStyleNumber === (idx + 1);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedStyleNumber(idx + 1)}
                                      className={cn(
                                        "relative aspect-square rounded-xl overflow-hidden border-2 transition-all bg-white p-0 text-left cursor-pointer",
                                        isSelected ? "scale-[1.01]" : "border-gray-200 hover:border-gray-300"
                                      )}
                                      style={{ borderColor: isSelected ? (settings.primaryColor || '#865d39') : 'transparent' }}
                                    >
                                      <img
                                        src={img}
                                        alt={`Estilo ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <div className="absolute top-1 left-1 bg-black/75 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full z-10">
                                        #{idx + 1}
                                      </div>
                                      {isSelected && (
                                        <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                                          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}>
                                            <Check size={12} />
                                          </div>
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}

                  {/* Customizable Meal Options in Details Modal */}
                  {selectedProductForDetails.isMeal && (() => {
                    const hasExclusions = !!(selectedProductForDetails.ingredients && selectedProductForDetails.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
                    const hasSides = !!(selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
                    if (!hasExclusions && !hasSides) return null;
                    return (
                      <div className="border-t border-gray-200/30 pt-6 space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-wider text-black/60">Personalizar Refeição</h4>
                        
                        {/* Exclusions */}
                        {selectedProductForDetails.ingredients && (() => {
                          const ingredientsList = selectedProductForDetails.ingredients
                            .split(',')
                            .map(i => i.trim())
                            .filter(Boolean);
                          if (ingredientsList.length === 0) return null;
                          return (
                            <div className="space-y-3">
                              <p className="text-xs font-bold text-black/60">{t.excludeIngredients}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {ingredientsList.map((ingredient, idx) => {
                                  const isSelected = mealSelections.removals.includes(ingredient);
                                  return (
                                    <button 
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setMealSelections({
                                            ...mealSelections,
                                            removals: mealSelections.removals.filter(r => r !== ingredient)
                                          });
                                        } else {
                                          setMealSelections({
                                            ...mealSelections,
                                            removals: [...mealSelections.removals, ingredient]
                                          });
                                        }
                                      }}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full border-2 font-bold transition-all text-xs cursor-pointer",
                                        isSelected 
                                          ? "bg-red-500 border-red-500 text-white shadow-sm" 
                                          : "bg-white border-gray-200 text-black"
                                      )}
                                    >
                                      {ingredient}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Sides and Swaps */}
                        {selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.length > 0 && (
                          (() => {
                            const allowedSidesList = (selectedProductForDetails.allowedSides || [])
                              .map(id => sides.find(s => s.id === id))
                              .filter(Boolean) as Side[];
                            
                            const regularSides = allowedSidesList.filter(s => s.type !== 'swap');
                            const swapSides = allowedSidesList.filter(s => s.type === 'swap');

                            if (regularSides.length === 0 && swapSides.length === 0) return null;

                            const renderSideItem = (side: Side) => {
                              const qty = sideQuantities[side.id] || 0;
                              return (
                                <div 
                                  key={side.id}
                                  className={cn(
                                    "p-3 rounded-xl border border-gray-200 font-bold transition-all flex justify-between items-center bg-white text-xs text-black shadow-sm"
                                  )}
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="font-bold text-black truncate">{side.name}</span>
                                    <span className="text-[10px] text-gray-500 font-extrabold mt-0.5">
                                      {side.price > 0 ? `+ ${currencySymbol}${side.price.toFixed(2)}` : 'Grátis'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2.5">
                                    <button 
                                      type="button"
                                      onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: Math.max(0, (prev[side.id] || 0) - 1) }))}
                                      className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer border border-gray-200 focus:outline-none"
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <span className="w-4 text-center font-bold text-black">{qty}</span>
                                    <button 
                                      type="button"
                                      onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: (prev[side.id] || 0) + 1 }))}
                                      className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer focus:outline-none"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            };

                            return (
                              <div className="space-y-4">
                                {regularSides.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold text-black/60">{t.chooseSides}</p>
                                    <div className="grid grid-cols-1 gap-1.5">
                                      {regularSides.map(renderSideItem)}
                                    </div>
                                  </div>
                                )}
                                {swapSides.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-xs font-bold text-amber-800">
                                      Opções de Troca
                                    </p>
                                    <div className="grid grid-cols-1 gap-1.5">
                                      {swapSides.map(renderSideItem)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    );
                  })()}

                  {/* Customizable Sandwich Options in Details Modal */}
                  {selectedProductForDetails.isCustomSandwich && (
                    <div className="border-t border-gray-200/30 pt-6 space-y-6">
                      <h4 className="text-sm font-black uppercase tracking-wider text-black/60">
                        {'Opção de Estado da Marmita (Congelada / Natural / Fresca)'}
                      </h4>
                      
                      {/* Fillings Selection for Custom Sandwich */}
                      {selectedProductForDetails.customFillings && (() => {
                        const fillingsList = selectedProductForDetails.customFillings
                          .split(',')
                          .map(f => f.trim())
                          .filter(Boolean);
                        if (fillingsList.length === 0) return null;
                        return (
                          <div className="space-y-4">
                            <p className="text-xs font-bold text-black/60">
                              {'Selecione as Quantidades por Opção'}
                            </p>
                            <div className="grid grid-cols-1 gap-2.5">
                              {fillingsList.map((fillingOpt, idx) => {
                                const qty = sandwichFillingQuantities[fillingOpt] || 0;
                                return (
                                  <div
                                    key={idx}
                                    className="p-3.5 rounded-2xl border transition-all flex items-center justify-between font-bold text-xs bg-white/70 border-white/25 shadow-sm"
                                  >
                                    <span className="text-sm font-bold text-black">{fillingOpt}</span>
                                    
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={qty === 0}
                                        onClick={() => {
                                          setSandwichFillingQuantities(prev => ({
                                            ...prev,
                                            [fillingOpt]: Math.max(0, qty - 1)
                                          }));
                                        }}
                                        className={cn(
                                          "w-7 h-7 rounded-full bg-white flex items-center justify-center text-black border border-gray-200 shadow-xs cursor-pointer active:scale-95 transition-all text-xs font-bold",
                                          qty === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-50"
                                        )}
                                      >
                                        <Minus size={12} />
                                      </button>
                                      <span className="text-xs font-black min-w-[16px] text-center text-black">{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSandwichFillingQuantities(prev => ({
                                            ...prev,
                                            [fillingOpt]: qty + 1
                                          }));
                                        }}
                                        className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-xs cursor-pointer active:scale-95 transition-all text-xs font-bold"
                                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                      >
                                        <Plus size={12} />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Sticky Action Block */}
              <div className="p-4 pb-6 md:p-6 bg-white/40 border-t border-white/20 flex flex-col gap-4">
                {(() => {
                  const hasSizesOpt = !!(selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0);
                  const hasExclusionsOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.ingredients && selectedProductForDetails.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
                  const hasSidesOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
                  const isCustomCakeOpt = !!selectedProductForDetails.isCustomCake;
                  const isCustomSandwichOpt = !!selectedProductForDetails.isCustomSandwich;
                  const requiresCustomization = hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;
                  
                  const isSizesOnly = hasSizesOpt && !requiresCustomization;
                  const showGlobalQuantity = !isCustomSandwichOpt && !hasSizesOpt;

                  if (!showGlobalQuantity) return null;

                  return (
                    <div id="details-modal-qty-container" className="flex items-center justify-between bg-white/50 p-3 rounded-xl border border-white/10">
                      <span id="details-modal-qty-label" className="text-xs font-bold text-black uppercase tracking-wider">
                        {'Quantidade'}
                      </span>
                      <div className="flex items-center gap-2.5">
                        <button
                          id="details-modal-qty-dec-btn"
                          type="button"
                          onClick={() => setCustomItemQuantity(prev => Math.max(1, prev - 1))}
                          className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black shadow-sm cursor-pointer active:scale-95 transition-all text-sm font-bold border border-gray-200"
                        >
                          <Minus size={14} />
                        </button>
                        <span id="details-modal-qty-value" className="text-sm font-black min-w-[20px] text-center text-black">{customItemQuantity}</span>
                        <button
                          id="details-modal-qty-inc-btn"
                          type="button"
                          onClick={() => setCustomItemQuantity(prev => {
                            if (selectedProductForDetails.trackStock) {
                              const currentInCart = getProductTotalInCart(selectedProductForDetails.id);
                              const maxStock = typeof selectedProductForDetails.stockQuantity === 'number' ? selectedProductForDetails.stockQuantity : 0;
                              if (prev + currentInCart >= maxStock) {
                                toast.error(`Limite de estoque atingido (${maxStock} un disponíveis).`);
                                return prev;
                              }
                            }
                            return prev + 1;
                          })}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all text-sm font-bold"
                          style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const hasSizesOpt = !!(selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0);
                  const hasExclusionsOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.ingredients && selectedProductForDetails.ingredients.split(',').map(i => i.trim()).filter(Boolean).length > 0);
                  const hasSidesOpt = !!(selectedProductForDetails.isMeal && selectedProductForDetails.allowedSides && selectedProductForDetails.allowedSides.filter(id => sides.some(s => s.id === id)).length > 0);
                  const isCustomCakeOpt = !!selectedProductForDetails.isCustomCake;
                  const isCustomSandwichOpt = !!selectedProductForDetails.isCustomSandwich;
                  const requiresCustomization = hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;
                  const isSizesOnly = hasSizesOpt && !requiresCustomization;

                  if (isSizesOnly) {
                    return (
                      <div className="flex gap-3 items-center w-full">
                        <button
                          type="button"
                          onClick={() => setSelectedProductForDetails(null)}
                          className="px-5 py-3 rounded-xl border border-black/10 bg-white hover:bg-gray-50 text-black font-serif font-bold text-xs cursor-pointer transition-all border-0 focus:outline-none whitespace-nowrap"
                        >
                          {'Voltar ao Cardápio'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const hasItemsInCart = cart.some(item => item.productId === selectedProductForDetails.id);
                            if (!hasItemsInCart) {
                              toast.error('Por favor, adicione pelo menos uma opção clicando em "+ ADICIONAR" ou clique em "Voltar ao Cardápio" para retornar.');
                              return;
                            }
                            setSelectedProductForDetails(null);
                            setIsModalOpen(true);
                          }}
                          className="flex-grow py-3 px-5 rounded-xl font-serif font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all text-center border-0 focus:outline-none cursor-pointer flex justify-center items-center gap-1.5 whitespace-nowrap"
                          style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                        >
                          Fechar e Ver Pedido
                        </button>
                      </div>
                    );
                  }

                  const isCakeIncomplete = selectedProductForDetails.isCustomCake && (
                    (cakeSizesList.length > 0 && !selectedCakeSize) ||
                    (cakeDoughsList.length > 0 && !selectedDough) ||
                    (cakeFillingsList.length > 0 && selectedFillings.length === 0) ||
                    (cakeToppingsList.length > 0 && !selectedTopping) ||
                    (cakeToppersList.length > 0 && !selectedTopper)
                  );

                  const isSandwichIncomplete = selectedProductForDetails.isCustomSandwich && (
                    (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0) === 0
                  );

                  const basePrice = (selectedProductForDetails.sizes && selectedProductForDetails.sizes.length > 0 && selectedSize) 
                    ? selectedSize.price 
                    : (selectedProductForDetails.price > 0 ? selectedProductForDetails.price : (selectedProductForDetails.oldPrice || 0));
                  
                  const sidesPrice = Object.entries(sideQuantities).reduce((sum, [id, qty]) => {
                    const side = sides.find(s => s.id === id);
                    return sum + (side ? side.price * (qty as number) : 0);
                  }, 0);

                  const totalPrice = basePrice + sidesPrice;

                  const isOutOfStock = !!(getDishTrackedStockInfo(selectedProductForDetails).isTracked && getProductAvailableStock(selectedProductForDetails) <= 0);

                  const getButtonLabel = () => {
                    if (isOutOfStock) {
                      return 'Produto Esgotado';
                    }
                    if (isCustomCakeOpt && isCakeIncomplete) {
                      return 'Complete as opções primeiro';
                    }
                    if (selectedProductForDetails.isCustomSandwich && isSandwichIncomplete) {
                      return 'Selecione a opção primeiro';
                    }
                    return 'Adicionar ao Pedido';
                  };

                  const isDisabled = isOutOfStock || !!isCakeIncomplete || !!isSandwichIncomplete;

                  const totalQty = selectedProductForDetails.isCustomSandwich
                    ? (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0)
                    : customItemQuantity;

                  return (
                    <div className="flex gap-3 items-center">
                      <button
                        type="button"
                        onClick={() => setSelectedProductForDetails(null)}
                        className="px-5 py-3 rounded-xl border border-black/10 bg-white hover:bg-gray-50 text-black font-serif font-bold text-xs cursor-pointer transition-all border-0 focus:outline-none"
                      >
                        Fechar
                      </button>
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          const requiresFullCustomization = hasSizesOpt || hasExclusionsOpt || hasSidesOpt || isCustomCakeOpt || isCustomSandwichOpt;
                          if (requiresFullCustomization) {
                            addDetailedProductToCart(selectedProductForDetails);
                          } else {
                            addToCart(selectedProductForDetails, customItemQuantity);
                            setSelectedProductForDetails(null);
                            toast.success('Adicionado com sucesso ao pedido!');
                          }
                        }}
                        className={cn(
                          "flex-grow py-3 px-5 rounded-xl font-serif font-bold text-xs shadow-md transition-all text-center border-0 focus:outline-none cursor-pointer flex justify-center items-center gap-1.5",
                          isDisabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-110 active:scale-95"
                        )}
                        style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                      >
                        <span>{getButtonLabel()}</span>
                        {totalPrice > 0 && (
                          <span className="opacity-80 font-normal">
                            ({currencySymbol}{(totalPrice * totalQty).toFixed(2)})
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMBO SELECTION MODAL */}
      <AnimatePresence>
        {selectedComboProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedComboProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#ece6db] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 border border-white/40"
            >
              {/* Header */}
              <div className="p-3.5 sm:p-5 border-b border-gray-200/60 bg-white/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  {selectedComboProduct.image && (
                    <img 
                      src={selectedComboProduct.image} 
                      alt={selectedComboProduct.title} 
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-gray-200 shrink-0 shadow-sm" 
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] sm:text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-950 inline-block mb-0.5">
                      Combo Personalizável
                    </span>
                    <h3 className="font-serif font-bold text-sm sm:text-lg text-gray-900 truncate leading-tight">
                      {selectedComboProduct.title}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-gray-500 block leading-none">Preço</span>
                    <span className="font-serif font-black text-sm sm:text-lg text-gray-900 whitespace-nowrap">
                      {currencySymbol} {(selectedComboProduct.price > 0 ? selectedComboProduct.price : (selectedComboProduct.oldPrice || 0)).toFixed(2)}
                    </span>
                  </div>
                  <button 
                    onClick={() => setSelectedComboProduct(null)} 
                    className="p-2 hover:bg-gray-200/60 rounded-full transition-colors text-gray-600 hover:text-black shrink-0 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center border-0 bg-transparent"
                    aria-label="Fechar"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Progress & Target Lock Banner */}
              {(() => {
                const targetQty = Number(selectedComboProduct.comboQuantity) || 5;
                const currentTotal = (Object.values(comboDishSelections) as number[]).reduce((a, b) => a + b, 0);
                const isComplete = currentTotal === targetQty;
                const remaining = targetQty - currentTotal;
                const progressPct = Math.min(100, (currentTotal / targetQty) * 100);

                return (
                  <div className={cn(
                    "p-3.5 sm:p-4 transition-colors border-b space-y-2",
                    isComplete 
                      ? "bg-emerald-50/90 border-emerald-200 text-emerald-950" 
                      : "bg-amber-50/90 border-amber-200 text-amber-950"
                  )}>
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wide">
                      <span className="flex items-center gap-1.5">
                        {isComplete ? '✓ Combo Completo!' : `Escolha seus sabores:`}
                      </span>
                      <span className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-bold",
                        isComplete ? "bg-emerald-200 text-emerald-900" : "bg-amber-200 text-amber-900"
                      )}>
                        {currentTotal} de {targetQty} marmitas selecionadas
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-2.5 bg-black/10 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-300 rounded-full",
                          isComplete ? "bg-emerald-600" : "bg-amber-600"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    <p className="text-[11px] font-medium leading-tight">
                      {isComplete ? (
                        <span className="text-emerald-800 font-bold">
                          Tudo pronto! Você selecionou exatamente as {targetQty} marmitas. Agora clique no botão abaixo para adicionar ao seu pedido.
                        </span>
                      ) : remaining > 0 ? (
                        <span className="text-amber-900">
                          Selecione mais <strong>{remaining} marmita(s)</strong> para atingir o limite de {targetQty} marmitas deste combo.
                        </span>
                      ) : (
                        <span className="text-red-700 font-bold">
                          Você ultrapassou o limite do combo! Remova {Math.abs(remaining)} marmita(s).
                        </span>
                      )}
                    </p>
                  </div>
                );
              })()}

              {/* Body: Search and Dishes List */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-grow space-y-4">
                {selectedComboProduct.description && (
                  <p className="text-xs text-gray-600 italic bg-white/40 p-2.5 rounded-xl border border-black/5">
                    {selectedComboProduct.description}
                  </p>
                )}

                {/* Filter Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    type="text"
                    placeholder="Buscar sabor ou prato..."
                    value={comboSearchTerm}
                    onChange={e => setComboSearchTerm(e.target.value)}
                    className="w-full p-2.5 pl-9 text-xs rounded-xl border border-gray-300 bg-white text-black font-medium focus:ring-2 focus:ring-amber-800/30"
                  />
                </div>

                {/* List of Dishes */}
                {(() => {
                  const targetQty = Number(selectedComboProduct.comboQuantity) || 5;
                  const currentTotal = (Object.values(comboDishSelections) as number[]).reduce((a, b) => a + b, 0);

                  const allowedIds = selectedComboProduct.comboAllowedProductIds;
                  let availableDishes = products
                    .filter(p => !p.isCombo && p.isActive !== false)
                    .sort((a, b) => {
                      const orderA = typeof a.order === 'number' ? a.order : 9999;
                      const orderB = typeof b.order === 'number' ? b.order : 9999;
                      if (orderA !== orderB) return orderA - orderB;
                      return a.title.localeCompare(b.title);
                    });

                  if (allowedIds && allowedIds.length > 0) {
                    availableDishes = availableDishes.filter(p => allowedIds.includes(p.id));
                  }

                  if (comboSearchTerm.trim()) {
                    const term = comboSearchTerm.toLowerCase();
                    availableDishes = availableDishes.filter(p => {
                      const cat = categories.find(c => c.id === p.categoryId)?.title?.toLowerCase() || '';
                      return p.title.toLowerCase().includes(term) || cat.includes(term) || (p.description || '').toLowerCase().includes(term);
                    });
                  }

                  if (availableDishes.length === 0) {
                    return (
                      <div className="text-center py-8 text-xs text-gray-500 font-medium bg-white/50 rounded-2xl border border-dashed border-gray-300 p-4">
                        Nenhum prato disponível para este combo no momento.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {availableDishes.map((dish) => {
                        const qty = comboDishSelections[dish.id] || 0;
                        const cat = categories.find(c => c.id === dish.categoryId);
                        const canAddMoreCombo = currentTotal < targetQty;

                        // Validação de estoque individual para marmita selecionada no combo
                        const stockInfo = getDishTrackedStockInfo(dish);
                        const isDishTracked = stockInfo.isTracked;
                        const availableStock = getProductAvailableStock(dish);
                        const canAddDishStock = !isDishTracked || qty < availableStock;
                        const canAddMore = canAddMoreCombo && canAddDishStock;
                        const isAvailable = availableStock > 0;

                        return (
                          <div 
                            key={dish.id}
                            className={cn(
                              "p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                              qty > 0 ? "bg-white border-amber-300 shadow-sm" : "bg-white/70 border-gray-200 hover:bg-white"
                            )}
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-grow">
                              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-100 border border-gray-200">
                                {dish.image ? (
                                  <img src={dish.image} alt={dish.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">🍽️</div>
                                )}
                              </div>

                              <div className="min-w-0 space-y-1">
                                <h4 
                                  className="font-bold text-sm sm:text-base leading-snug break-words"
                                  style={{ color: settings.primaryColor || '#865d39' }}
                                >
                                  {dish.title}
                                </h4>

                                {isDishTracked && (
                                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                    <span className={cn(
                                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-2xs text-white",
                                      isAvailable ? "bg-[#00753A]" : "bg-red-600"
                                    )}>
                                      {isAvailable ? "Pronta Entrega" : "Esgotado"}
                                    </span>
                                    {isAvailable ? (
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#fef9c3] text-[#854d0e] border border-[#fde047] whitespace-nowrap shadow-2xs">
                                        {availableStock} {availableStock === 1 ? 'unidade' : 'unidades'}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 whitespace-nowrap shadow-2xs">
                                        Esgotado
                                      </span>
                                    )}
                                  </div>
                                )}

                                {dish.description && (
                                  <p className="text-[11px] text-black/75 leading-relaxed line-clamp-2 pt-0.5">
                                    {dish.description}
                                  </p>
                                )}

                                {/* Button to view full description and nutritional table */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedDishForNutritionalInfo(dish)}
                                  className="text-xs font-bold underline hover:opacity-80 flex items-center cursor-pointer pt-0.5"
                                  style={{ color: settings.primaryColor || '#865d39' }}
                                >
                                  <span>Ver Descrição e Tabela Nutricional</span>
                                </button>
                              </div>
                            </div>

                            {/* Stepper Controls */}
                            <div className="flex items-center justify-end w-full sm:w-auto gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                              <span className="text-[11px] text-gray-500 sm:hidden font-bold">Quantidade:</span>
                              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                                <button
                                  type="button"
                                  disabled={qty === 0}
                                  onClick={() => {
                                    setComboDishSelections(prev => {
                                      const next = { ...prev };
                                      if (qty <= 1) {
                                        delete next[dish.id];
                                      } else {
                                        next[dish.id] = qty - 1;
                                      }
                                      return next;
                                    });
                                  }}
                                  className={cn(
                                    "w-8 h-8 rounded-lg bg-white flex items-center justify-center text-gray-800 font-bold shadow-xs transition-all cursor-pointer",
                                    qty === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100 active:scale-95"
                                  )}
                                >
                                  <Minus size={14} />
                                </button>

                                <span className="font-extrabold text-sm min-w-[24px] text-center text-gray-900">
                                  {qty}
                                </span>

                                <button
                                  type="button"
                                  disabled={!canAddMore}
                                  onClick={() => {
                                    if (!canAddMoreCombo) {
                                      toast.error(`Você já atingiu o limite de ${targetQty} marmitas deste combo!`);
                                      return;
                                    }
                                    if (!canAddDishStock) {
                                      toast.error(`Limite de estoque atingido para "${dish.title}" (${availableStock} un disponíveis).`);
                                      return;
                                    }
                                    setComboDishSelections(prev => ({
                                      ...prev,
                                      [dish.id]: (prev[dish.id] || 0) + 1
                                    }));
                                  }}
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-xs transition-all cursor-pointer",
                                    !canAddMore ? "opacity-40 cursor-not-allowed bg-gray-400" : "hover:brightness-110 active:scale-95"
                                  )}
                                  style={{ backgroundColor: canAddMore ? (settings.primaryColor || '#865d39') : undefined }}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Bottom Sticky Action */}
              {(() => {
                const targetQty = Number(selectedComboProduct.comboQuantity) || 5;
                const currentTotal = (Object.values(comboDishSelections) as number[]).reduce((a, b) => a + b, 0);
                const isComplete = currentTotal === targetQty;

                return (
                  <div className="p-4 sm:p-5 bg-white/70 border-t border-gray-200 flex gap-3 items-center">
                    <button
                      type="button"
                      onClick={() => setSelectedComboProduct(null)}
                      className="px-5 py-3 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-bold text-xs cursor-pointer transition-all"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      disabled={!isComplete}
                      onClick={handleAddComboToCart}
                      className={cn(
                        "flex-grow py-3 px-5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all text-center flex items-center justify-center gap-2 cursor-pointer",
                        !isComplete ? "opacity-50 cursor-not-allowed bg-gray-400 text-white" : "hover:brightness-110 active:scale-95"
                      )}
                      style={{ 
                        backgroundColor: isComplete ? (settings.primaryColor || '#865d39') : undefined,
                        color: isComplete ? getContrastText(settings.primaryColor || '#865d39') : undefined
                      }}
                    >
                      <span>
                        {isComplete 
                          ? `Adicionar Combo (${currentTotal} Marmitas) ao Pedido`
                          : `Selecione ${targetQty - currentTotal} marmita(s) para completar`}
                      </span>
                    </button>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DISH NUTRITIONAL & DESCRIPTION SUB-MODAL */}
      <AnimatePresence>
        {selectedDishForNutritionalInfo && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDishForNutritionalInfo(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black font-sans force-dark-headings"
              style={{ '--text-color': '#000000' } as any}
            >
              {/* Close button top right overlay */}
              <button
                onClick={() => setSelectedDishForNutritionalInfo(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/35 hover:bg-black/50 text-white backdrop-blur-sm rounded-full transition-all border-0 focus:outline-none cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Scrollable Container */}
              <div className="overflow-y-auto w-full flex-grow">
                {/* Hero Product Image */}
                {selectedDishForNutritionalInfo.image ? (
                  <div className="w-full aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                    <img 
                      src={selectedDishForNutritionalInfo.image} 
                      alt={selectedDishForNutritionalInfo.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : (
                  <div className="w-full h-32 bg-amber-100/50 flex items-center justify-center">
                    <Utensils size={40} className="text-amber-900/30" />
                  </div>
                )}

                <div className="p-6 md:p-8 space-y-6">
                  {/* Title & Category */}
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-serif font-black tracking-tight text-black leading-tight">
                      {selectedDishForNutritionalInfo.title}
                    </h2>
                    {(() => {
                      const catTitle = selectedDishForNutritionalInfo.categoryTitle || categories.find(c => c.id === selectedDishForNutritionalInfo.categoryId)?.title;
                      return catTitle ? (
                        <span className="inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-950 rounded-lg">
                          {catTitle}
                        </span>
                      ) : null;
                    })()}

                    {(selectedDishForNutritionalInfo.trackStock || getDishTrackedStockInfo(selectedDishForNutritionalInfo).isTracked) && (() => {
                      const available = getProductAvailableStock(selectedDishForNutritionalInfo);
                      const isAvailable = available > 0;
                      return (
                        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                          <span className={cn(
                            "text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs text-white",
                            isAvailable ? "bg-[#00753A]" : "bg-red-600"
                          )}>
                            {isAvailable ? "Pronta Entrega" : "Esgotado"}
                          </span>
                          {isAvailable ? (
                            <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef9c3] text-[#854d0e] border border-[#fde047] whitespace-nowrap shadow-2xs">
                              {available} {available === 1 ? 'unidade' : 'unidades'}
                            </span>
                          ) : (
                            <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 whitespace-nowrap shadow-2xs">
                              Esgotado
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Pricing Display */}
                  {selectedDishForNutritionalInfo.price > 0 && (
                    <div className="p-4 rounded-2xl bg-white/50 border border-white/20">
                      <label className="text-[10px] font-black uppercase text-black/50 block tracking-wider mb-1">
                        PREÇO UNITÁRIO
                      </label>
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-serif font-black text-black">
                          {currencySymbol}{selectedDishForNutritionalInfo.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Extended Description Section */}
                  {(selectedDishForNutritionalInfo.description || selectedDishForNutritionalInfo.ingredients) && (
                    <div className="space-y-2 text-black">
                      <h3 className="text-xs font-black uppercase tracking-wider text-black/60">Descrição do Produto</h3>
                      {selectedDishForNutritionalInfo.description && (
                        <p className="text-sm leading-relaxed text-black/80 font-medium whitespace-pre-wrap">
                          {selectedDishForNutritionalInfo.description}
                        </p>
                      )}
                      {selectedDishForNutritionalInfo.ingredients && (
                        <p className="text-sm leading-relaxed text-black/80 font-medium whitespace-pre-wrap">
                          {selectedDishForNutritionalInfo.ingredients.toUpperCase().startsWith('INGREDIENTES:') 
                            ? selectedDishForNutritionalInfo.ingredients 
                            : `INGREDIENTES: ${selectedDishForNutritionalInfo.ingredients}`}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tabela Nutricional */}
                  {selectedDishForNutritionalInfo.nutritionalInfo && (() => {
                    const info = selectedDishForNutritionalInfo.nutritionalInfo;
                    const hasNutritionalInfo = info && (
                      info.servingSize || info.servingsPerContainer ||
                      info.calories || info.carbohydrates || info.carbs || info.totalSugars || info.addedSugars ||
                      info.proteins || info.totalFat || info.saturatedFat || info.transFat || info.fiber || info.sodium
                    );
                    if (!hasNutritionalInfo) return null;

                    const hasAnyVd = Boolean(
                      info.caloriesVd || info.carbsVd || info.totalSugarsVd || info.addedSugarsVd ||
                      info.proteinsVd || info.totalFatVd || info.saturatedFatVd || info.transFatVd ||
                      info.fiberVd || info.sodiumVd
                    );
                    
                    return (
                      <div className="space-y-3 pt-4 border-t border-gray-200/40">
                        <h3 className="text-xs font-black uppercase tracking-wider text-black/60 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          Tabela Nutricional
                        </h3>
                        <div className="border-2 border-black rounded-xl p-3.5 bg-white shadow-sm font-sans max-w-md mx-auto text-black">
                          <p className="text-center font-black text-base uppercase tracking-wider border-b-2 border-black pb-1">
                            Informação Nutricional
                          </p>

                          {(info.servingsPerContainer || info.servingSize) && (
                            <div className="text-[11px] font-semibold border-b border-black py-1.5 space-y-0.5 text-gray-800">
                              {info.servingsPerContainer && (
                                <p>Porções por embalagem: <span className="font-bold text-black">{info.servingsPerContainer}</span></p>
                              )}
                              {info.servingSize && (
                                <p>Porção: <span className="font-bold text-black">{info.servingSize}</span></p>
                              )}
                            </div>
                          )}

                          <div className="text-xs divide-y divide-black/15 mt-1">
                            <div className="flex justify-between items-center py-1 font-black text-[11px] border-b-2 border-black">
                              <span>Item / Nutriente</span>
                              <div className="flex items-center gap-4">
                                <span className="text-right">Qtd.</span>
                                {hasAnyVd && <span className="w-12 text-right">% VD*</span>}
                              </div>
                            </div>

                            {/* Valor Energético */}
                            {info.calories && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Valor energético (kcal)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.calories} kcal</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.caloriesVd ? `${info.caloriesVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Carboidratos */}
                            {(info.carbohydrates || info.carbs) && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Carboidratos (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.carbs || info.carbohydrates} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.carbsVd ? `${info.carbsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Açúcares Totais */}
                            {info.totalSugars && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Açúcares totais (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.totalSugars} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.totalSugarsVd ? `${info.totalSugarsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Açúcares Adicionados */}
                            {info.addedSugars && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Açúcares adicionados (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.addedSugars} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.addedSugarsVd ? `${info.addedSugarsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Proteínas */}
                            {info.proteins && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Proteínas (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.proteins} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.proteinsVd ? `${info.proteinsVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Gorduras Totais */}
                            {info.totalFat && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Gorduras totais (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.totalFat} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.totalFatVd ? `${info.totalFatVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Gorduras Saturadas */}
                            {info.saturatedFat && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Gorduras saturadas (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.saturatedFat} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.saturatedFatVd ? `${info.saturatedFatVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Gorduras Trans */}
                            {info.transFat && (
                              <div className="flex justify-between items-center py-1 pl-3 text-gray-800">
                                <span>↳ Gorduras trans (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="font-semibold text-right">{info.transFat} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.transFatVd ? `${info.transFatVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Fibras */}
                            {info.fiber && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Fibra alimentar (g)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.fiber} g</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.fiberVd ? `${info.fiberVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}

                            {/* Sódio */}
                            {info.sodium && (
                              <div className="flex justify-between items-center py-1 font-bold">
                                <span>Sódio (mg)</span>
                                <div className="flex items-center gap-4">
                                  <span className="text-right">{info.sodium} mg</span>
                                  {hasAnyVd && <span className="w-12 text-right font-normal text-gray-700">{info.sodiumVd ? `${info.sodiumVd}%` : '-'}</span>}
                                </div>
                              </div>
                            )}
                          </div>

                          <p className="text-[9px] text-gray-500 mt-2 text-center leading-tight">
                            * Percentual de valores diários (% VD) fornecidos pela porção.
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom Sticky Action Block */}
              <div className="p-4 pb-6 md:p-6 bg-white/40 border-t border-white/20 flex flex-col gap-4">
                {(() => {
                  const targetQty = selectedComboProduct ? (Number(selectedComboProduct.comboQuantity) || 5) : 5;
                  const currentTotal = (Object.values(comboDishSelections) as number[]).reduce((a, b) => a + b, 0);
                  const currentDishQty = comboDishSelections[selectedDishForNutritionalInfo.id] || 0;
                  const canAddMoreCombo = currentTotal < targetQty;

                  const availableStock = getProductAvailableStock(selectedDishForNutritionalInfo);
                  const canAddDishStock = !getDishTrackedStockInfo(selectedDishForNutritionalInfo).isTracked || currentDishQty < availableStock;
                  const canAddMore = canAddMoreCombo && canAddDishStock;

                  return (
                    <>
                      {/* Quantity row */}
                      <div className="flex items-center justify-between bg-white/50 p-3 rounded-xl border border-white/10">
                        <span className="text-xs font-bold text-black uppercase tracking-wider">
                          Quantidade no Combo
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={currentDishQty === 0}
                            onClick={() => {
                              setComboDishSelections(prev => {
                                const next = { ...prev };
                                if (currentDishQty <= 1) {
                                  delete next[selectedDishForNutritionalInfo.id];
                                } else {
                                  next[selectedDishForNutritionalInfo.id] = currentDishQty - 1;
                                }
                                return next;
                              });
                            }}
                            className={cn(
                              "w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black shadow-sm cursor-pointer active:scale-95 transition-all text-sm font-bold border border-gray-200",
                              currentDishQty === 0 && "opacity-30 cursor-not-allowed"
                            )}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-black min-w-[20px] text-center text-black">
                            {currentDishQty}
                          </span>
                          <button
                            type="button"
                            disabled={!canAddMore}
                            onClick={() => {
                              if (!canAddMoreCombo) {
                                toast.error(`Você já atingiu o limite de ${targetQty} marmitas deste combo!`);
                                return;
                              }
                              if (!canAddDishStock) {
                                toast.error(`Limite de estoque atingido para "${selectedDishForNutritionalInfo.title}" (${availableStock} un disponíveis).`);
                                return;
                              }
                              setComboDishSelections(prev => ({
                                ...prev,
                                [selectedDishForNutritionalInfo.id]: (prev[selectedDishForNutritionalInfo.id] || 0) + 1
                              }));
                            }}
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all text-sm font-bold",
                              !canAddMore ? "opacity-30 cursor-not-allowed bg-gray-400" : ""
                            )}
                            style={{ backgroundColor: canAddMore ? (settings.primaryColor || '#865d39') : undefined }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-3 items-center">
                        <button
                          type="button"
                          onClick={() => setSelectedDishForNutritionalInfo(null)}
                          className="px-5 py-3 rounded-xl border border-black/10 bg-white hover:bg-gray-50 text-black font-serif font-bold text-xs cursor-pointer transition-all border-0 focus:outline-none whitespace-nowrap"
                        >
                          Fechar
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDishForNutritionalInfo(null)}
                          className="flex-grow py-3 px-5 rounded-xl font-serif font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition-all text-center border-0 focus:outline-none cursor-pointer flex justify-center items-center gap-1.5 whitespace-nowrap"
                          style={{ 
                            backgroundColor: settings.primaryColor || '#865d39', 
                            color: getContrastText(settings.primaryColor || '#865d39') 
                          }}
                        >
                          Confirmar e Voltar ao Combo
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCustomModalOpen && selectedProductForCustom && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] force-dark-headings"
            >
              <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white/30">
                <h2 className="text-2xl font-serif font-bold text-black" style={{ color: '#000000' }}>
                  {selectedProductForCustom.isCustomSandwich ? selectedProductForCustom.title : t.customCakeTitle}
                </h2>
                <button 
                  onClick={() => setIsCustomModalOpen(false)} 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors"
                  style={{ color: '#000000' }}
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
                {selectedProductForCustom.isCustomSandwich ? (
                  <>
                    {/* Sizes Selection for Custom Sandwich */}
                    {selectedProductForCustom.sizes && selectedProductForCustom.sizes.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                          {'Selecione a Opção de Estado'}
                        </h3>
                        <div className="grid grid-cols-1 gap-2.5">
                          {selectedProductForCustom.sizes.map((s) => {
                            const isSelected = selectedSize?.id === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSelectedSize(s);
                                  setSelectedSandwichFillings([]);
                                }}
                                className={cn(
                                  "p-4 rounded-2xl border-2 transition-all flex justify-between items-center w-full text-left font-bold",
                                  isSelected 
                                    ? "shadow-md scale-[1.01]" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold">{s.name}</span>
                                  {s.price && s.price > 0 && (
                                    <span className="text-xs opacity-80 font-semibold mt-0.5">
                                      {currencySymbol}{s.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: getContrastText(settings.primaryColor || '#865d39'), color: settings.primaryColor || '#865d39' }}>
                                    <Check size={12} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fillings Selection for Custom Sandwich */}
                    {selectedProductForCustom.customFillings && (() => {
                      const fillingsList = selectedProductForCustom.customFillings
                        .split(',')
                        .map(f => f.trim())
                        .filter(Boolean);
                      if (fillingsList.length === 0) return null;
                      return (
                        <div className="space-y-4 pt-4 border-t border-gray-200/30">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                            {'Selecione as Quantidades por Opção'}
                          </h3>
                          <div className="grid grid-cols-1 gap-2.5">
                            {fillingsList.map((fillingOpt, idx) => {
                              const qty = sandwichFillingQuantities[fillingOpt] || 0;
                              return (
                                <div
                                  key={idx}
                                  className="p-3.5 rounded-2xl border transition-all flex items-center justify-between font-bold text-sm bg-white/70 border-white/25 shadow-sm"
                                >
                                  <span className="text-sm font-bold text-black">{fillingOpt}</span>
                                  
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      disabled={qty === 0}
                                      onClick={() => {
                                        setSandwichFillingQuantities(prev => ({
                                          ...prev,
                                          [fillingOpt]: Math.max(0, qty - 1)
                                        }));
                                      }}
                                      className={cn(
                                        "w-8 h-8 rounded-full bg-white flex items-center justify-center text-black border border-gray-200 shadow-sm cursor-pointer active:scale-95 transition-all text-sm font-bold",
                                        qty === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-50"
                                      )}
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <span className="text-sm font-black min-w-[20px] text-center text-black">{qty}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSandwichFillingQuantities(prev => ({
                                          ...prev,
                                          [fillingOpt]: qty + 1
                                        }));
                                      }}
                                      className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all text-sm font-bold"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : selectedProductForCustom.isCustomCake ? (
                  <>
                    {/* Size Selection */}
                    {cakeSizesList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Tamanho / Fatias / Peso</h3>
                        <div className="grid grid-cols-1 gap-2.5">
                          {cakeSizesList.map((sizeOpt, idx) => {
                            const isSelected = selectedCakeSize === sizeOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedCakeSize(sizeOpt)}
                                className={cn(
                                  "p-4 rounded-2xl border-2 transition-all flex justify-between items-center w-full text-left font-bold",
                                  isSelected 
                                    ? "shadow-md scale-[1.01]" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                <span className="font-bold text-sm">
                                  {sizeOpt}
                                </span>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: getContrastText(settings.primaryColor || '#865d39'), color: settings.primaryColor || '#865d39' }}>
                                    <Check size={12} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Dough Selection */}
                    {cakeDoughsList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Escolha da Massa</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cakeDoughsList.map((doughOpt, idx) => {
                            const isSelected = selectedDough === doughOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedDough(doughOpt)}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all text-center text-sm font-bold w-full",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {doughOpt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Fillings Selection */}
                    {cakeFillingsList.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                          <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Opções de Recheio</h3>
                          <span className="text-xs text-gray-500 font-bold">Escolha até {settings.cakeFillingsMax || 2}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {cakeFillingsList.map((fillingOpt, idx) => {
                            const isSelected = selectedFillings.includes(fillingOpt);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedFillings(selectedFillings.filter(f => f !== fillingOpt));
                                  } else {
                                    const maxFillings = settings.cakeFillingsMax || 2;
                                    if (selectedFillings.length >= maxFillings) {
                                      toast.error(`Você pode escolher no máximo ${maxFillings} recheios!`);
                                      return;
                                    }
                                    setSelectedFillings([...selectedFillings, fillingOpt]);
                                  }
                                }}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all flex items-center justify-between font-bold text-sm",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                <span>{fillingOpt}</span>
                                <div className={cn(
                                  "w-4 h-4 rounded-md border flex items-center justify-center",
                                  isSelected ? "border-transparent" : "border-gray-300 bg-white"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? getContrastText(settings.primaryColor || '#865d39') : 'transparent',
                                  color: isSelected ? (settings.primaryColor || '#865d39') : 'transparent'
                                }}
                                >
                                  {isSelected && <Check size={10} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Toppings Selection */}
                    {cakeToppingsList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Escolha da Cobertura</h3>
                        <div className="grid grid-cols-2 gap-2.5">
                          {cakeToppingsList.map((toppingOpt, idx) => {
                            const isSelected = selectedTopping === toppingOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedTopping(toppingOpt)}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all text-center text-sm font-bold w-full",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {toppingOpt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Topper Selection */}
                    {cakeToppersList.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Topo de Bolo</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {cakeToppersList.map((topperOpt, idx) => {
                            const isSelected = selectedTopper === topperOpt;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedTopper(topperOpt)}
                                className={cn(
                                  "p-3 rounded-2xl border-2 transition-all text-center text-sm font-bold w-full",
                                  isSelected 
                                    ? "shadow-md" 
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{ 
                                  backgroundColor: isSelected ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: isSelected ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {topperOpt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Gallery Style Selection */}
                    {selectedProductForCustom.cakeGalleryId && (
                      (() => {
                        const associatedGallery = galleries.find(g => g.id === selectedProductForCustom.cakeGalleryId);
                        const validImages = associatedGallery?.images?.filter(img => img && img.trim() !== '') || [];
                        if (validImages.length === 0) return null;
                        
                        const noStyleText = selectedStyleNumber === null ? 'Selecionado: Base Tradicional (Sem Referência)' : 'Selecionar: Base Tradicional (Sem Referência)';

                        return (
                          <div className="space-y-4 pt-2">
                            <h3 className="text-sm font-serif font-black uppercase tracking-widest text-black/80">Estilo do Bolo / Referência Visual</h3>
                            <p className="text-[11px] font-semibold text-gray-500 -mt-1 leading-normal">
                              Selecione uma das fotos abaixo como modelo ou referência visual para o seu bolo personalizado. O número da foto correspondente será incluído no seu pedido!
                            </p>

                            {/* Separate "No Style Reference" Button styled like Add to Cart */}
                            <div className="w-full">
                              <button
                                type="button"
                                onClick={() => setSelectedStyleNumber(null)}
                                className={cn(
                                  "w-full py-3.5 rounded-2xl font-bold text-xs sm:text-sm shadow-sm transition-transform active:scale-[0.99] flex items-center justify-center gap-2 border-2 cursor-pointer uppercase tracking-wider",
                                  selectedStyleNumber === null
                                    ? "shadow-md text-white border-transparent"
                                    : "bg-white border-gray-200/50 hover:border-gray-300 text-black"
                                )}
                                style={{
                                  backgroundColor: selectedStyleNumber === null ? (settings.primaryColor || '#865d39') : '#ffffff',
                                  color: selectedStyleNumber === null ? getContrastText(settings.primaryColor || '#865d39') : '#000000',
                                  borderColor: settings.primaryColor || '#865d39'
                                }}
                              >
                                {selectedStyleNumber === null ? <Check size={16} /> : <X size={15} />}
                                <span>{noStyleText}</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">

                              {associatedGallery?.images?.map((img, idx) => {
                                if (!img || img.trim() === '') return null;
                                const isSelected = selectedStyleNumber === (idx + 1);
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setSelectedStyleNumber(idx + 1)}
                                    className={cn(
                                      "relative aspect-square rounded-2xl overflow-hidden border-2 transition-all bg-white group p-0 text-left cursor-pointer shadow-sm hover:shadow",
                                      isSelected
                                        ? "scale-[1.01]"
                                        : "border-gray-200/50 hover:border-gray-300"
                                    )}
                                    style={{ borderColor: isSelected ? (settings.primaryColor || '#865d39') : 'transparent' }}
                                  >
                                    <img
                                      src={img}
                                      alt={`Estilo ${idx + 1}`}
                                      className="w-full h-full object-cover select-none"
                                      referrerPolicy="no-referrer"
                                    />
                                    {/* Number Badge */}
                                    <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-sm text-white text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full z-10">
                                      Foto {idx + 1}
                                    </div>
                                    
                                    {/* Select Highlight Overlay */}
                                    <div className={cn(
                                      "absolute inset-0 transition-opacity flex items-center justify-center p-2 text-center",
                                      isSelected 
                                        ? "bg-black/35 opacity-100" 
                                        : "bg-black/0 opacity-0 group-hover:bg-black/10 group-hover:opacity-100"
                                    )}>
                                      {isSelected ? (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}>
                                          <Check size={18} />
                                        </div>
                                      ) : (
                                        <span className="text-[9px] font-bold text-white uppercase tracking-widest bg-black/40 px-2 py-1 rounded-full">Selecionar</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </>
                ) : (
                  <>
                    {/* Size Selection */}
                    {selectedProductForCustom.sizes && selectedProductForCustom.sizes.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-black">
                          {'Selecione o Tamanho / Porção'}
                        </h3>
                        <div className="space-y-2">
                          {selectedProductForCustom.sizes.map((s) => {
                            const cartItem = cart.find(item => item.productId === selectedProductForCustom.id && item.selectedSize?.id === s.id && !item.mealOptions);
                            const qty = cartItem ? cartItem.quantity : 0;
                            return (
                              <div
                                key={s.id}
                                className="flex justify-between items-center p-3.5 bg-white border border-gray-200 rounded-2xl font-bold text-black text-xs shadow-sm"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-black">{s.name}</span>
                                  {s.price && s.price > 0 && (
                                    <span className="text-xs text-gray-500 font-extrabold mt-0.5">
                                      {currencySymbol}{s.price.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {qty > 0 ? (
                                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-full border border-gray-200">
                                      <button
                                        type="button"
                                        onClick={() => decrementSizeQty(selectedProductForCustom, s)}
                                        className="w-8 h-8 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black shadow-sm cursor-pointer active:scale-95 transition-all"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <span className="text-sm font-black min-w-[20px] text-center text-black">{qty}</span>
                                      <button
                                        type="button"
                                        onClick={() => incrementSizeQty(selectedProductForCustom, s)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all"
                                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => incrementSizeQty(selectedProductForCustom, s)}
                                      className="px-4 py-2 rounded-full font-bold text-xs tracking-wider uppercase shadow-md hover:scale-105 active:scale-95 cursor-pointer transition-all flex items-center gap-1"
                                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                    >
                                      <Plus size={12} />
                                      <span>Adicionar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Ingredient Exclusions */}
                    {selectedProductForCustom.isMeal && selectedProductForCustom.ingredients && (() => {
                      const ingredientsList = selectedProductForCustom.ingredients
                        .split(',')
                        .map(i => i.trim())
                        .filter(Boolean);
                      if (ingredientsList.length === 0) return null;
                      return (
                        <div className="space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: '#000000' }}>{t.excludeIngredients}</h3>
                          <div className="flex flex-wrap gap-2">
                            {ingredientsList.map((ingredient, idx) => {
                              const isSelected = mealSelections.removals.includes(ingredient);
                              return (
                                <button 
                                  key={idx}
                                  onClick={() => {
                                    if (isSelected) {
                                      setMealSelections({
                                        ...mealSelections,
                                        removals: mealSelections.removals.filter(r => r !== ingredient)
                                      });
                                    } else {
                                      setMealSelections({
                                        ...mealSelections,
                                        removals: [...mealSelections.removals, ingredient]
                                      });
                                    }
                                  }}
                                  className={cn(
                                    "px-4 py-2 rounded-full border-2 font-bold transition-all text-sm",
                                    isSelected 
                                      ? "bg-red-500 border-red-500 text-white shadow-md" 
                                      : "bg-white/50 border-transparent text-black"
                                  )}
                                >
                                  {ingredient}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sides & Swaps Selection */}
                    {selectedProductForCustom.isMeal && selectedProductForCustom.allowedSides && selectedProductForCustom.allowedSides.length > 0 && (
                      (() => {
                        const allowedSidesList = (selectedProductForCustom.allowedSides || [])
                          .map(id => sides.find(s => s.id === id))
                          .filter(Boolean) as Side[];
                        
                        const regularSides = allowedSidesList.filter(s => s.type !== 'swap');
                        const swapSides = allowedSidesList.filter(s => s.type === 'swap');

                        if (regularSides.length === 0 && swapSides.length === 0) return null;

                        const renderSideItem = (side: Side) => {
                          const qty = sideQuantities[side.id] || 0;
                          return (
                            <div 
                              key={side.id}
                              className={cn(
                                "p-4 rounded-xl border-2 font-bold transition-all flex flex-col gap-3",
                                qty > 0 
                                  ? "bg-white border-blue-500 shadow-md" 
                                  : "bg-white/50 border-transparent text-black"
                              )}
                            >
                              <div className="flex justify-between items-center">
                                <span className={qty > 0 ? "text-blue-600" : "text-black"}>{side.name}</span>
                                <span className="text-xs opacity-60 text-black">
                                  {side.price > 0 ? `+ ${currencySymbol}${(side.price * (qty > 0 ? qty : 1)).toFixed(2)}` : 'Free'}
                                </span>
                              </div>
                              <div className="flex items-center justify-end gap-4">
                                <button 
                                  onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: Math.max(0, (prev[side.id] || 0) - 1) }))}
                                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-black active:scale-95 transition-transform cursor-pointer"
                                >
                                  <Minus size={16} />
                                </button>
                                <span className="w-4 text-center text-black">{qty}</span>
                                <button 
                                  onClick={() => setSideQuantities(prev => ({ ...prev, [side.id]: (prev[side.id] || 0) + 1 }))}
                                  className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
                                  style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-6">
                            {regularSides.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-black">{t.chooseSides}</h3>
                                <div className="grid grid-cols-1 gap-2">
                                  {regularSides.map(renderSideItem)}
                                </div>
                              </div>
                            )}
                            {swapSides.length > 0 && (
                              <div className="space-y-4">
                                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-800">
                                  Opções de Troca
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                  {swapSides.map(renderSideItem)}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </>
                )}
              </div>

              <div className="p-6 pb-8 sm:pb-6 bg-white/30 border-t border-gray-200">
                {selectedProductForCustom && !selectedProductForCustom.isCustomSandwich && (!selectedProductForCustom.sizes || selectedProductForCustom.sizes.length === 0) && (
                  <div id="custom-modal-qty-container" className="flex items-center justify-between mb-4 bg-white/50 p-3.5 rounded-2xl border border-gray-200/50">
                    <span id="custom-modal-qty-label" className="text-sm font-bold text-black uppercase tracking-wider">
                      Quantidade
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        id="custom-modal-qty-dec-btn"
                        type="button"
                        onClick={() => setCustomItemQuantity(prev => Math.max(1, prev - 1))}
                        className="w-10 h-10 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center text-black border border-gray-200 shadow-sm cursor-pointer active:scale-95 transition-all text-lg font-bold"
                      >
                        <Minus size={16} />
                      </button>
                      <span id="custom-modal-qty-value" className="text-base font-black min-w-[28px] text-center text-black">{customItemQuantity}</span>
                      <button
                        id="custom-modal-qty-inc-btn"
                        type="button"
                        onClick={() => setCustomItemQuantity(prev => prev + 1)}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md cursor-pointer active:scale-95 transition-all text-lg font-bold"
                        style={{ backgroundColor: settings.primaryColor || '#865d39' }}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {(() => {
                  const isCakeIncomplete = selectedProductForCustom?.isCustomCake && (
                    (cakeSizesList.length > 0 && !selectedCakeSize) ||
                    (cakeDoughsList.length > 0 && !selectedDough) ||
                    (cakeFillingsList.length > 0 && selectedFillings.length === 0) ||
                    (cakeToppingsList.length > 0 && !selectedTopping) ||
                    (cakeToppersList.length > 0 && !selectedTopper)
                  );
                  const isSandwichIncomplete = selectedProductForCustom?.isCustomSandwich && (
                    (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0) === 0
                  );
                  const isIncomplete = !!isCakeIncomplete || !!isSandwichIncomplete;

                  const totalQty = selectedProductForCustom?.isCustomSandwich
                    ? (Object.values(sandwichFillingQuantities) as number[]).reduce((sum, q) => sum + q, 0)
                    : customItemQuantity;

                  return (
                    <button 
                      onClick={addMealToCart}
                      disabled={isIncomplete}
                      className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${isIncomplete ? 'opacity-50 cursor-not-allowed active:scale-100' : 'active:scale-95 cursor-pointer hover:brightness-110'}`}
                      style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                    >
                      {isIncomplete ? (
                        <span>{isSandwichIncomplete ? 'Selecione a opção de estado da marmita' : 'Selecione todos os itens primeiro'}</span>
                      ) : (
                        <>
                          <span>{t.addToCart}</span>
                          <span className="text-sm opacity-80 font-normal">
                            ({currencySymbol}{(
                              ((selectedProductForCustom.sizes && selectedProductForCustom.sizes.length > 0 && selectedSize ? selectedSize.price : (selectedProductForCustom.price > 0 ? selectedProductForCustom.price : (selectedProductForCustom.oldPrice || 0))) + 
                              Object.entries(sideQuantities).reduce((sum, [id, qty]) => {
                                const side = sides.find(s => s.id === id);
                                return sum + (side ? side.price * (qty as number) : 0);
                              }, 0)) * totalQty
                            ).toFixed(2)})
                          </span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {renderDetoxModal()}
      {renderCustomDietModal()}
    </div>
  );

  function renderCustomDietModal() {
    const handleCustomDietWhatsApp = () => {
      const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '');
      if (!cleanPhone) {
        toast.error('Número de WhatsApp não configurado no painel administrativo.');
        return;
      }
      const message = "Olá Lu, estou navegando no app, quero fazer um pedido mas tenho dieta personalizada, você pode me ajudar?";
      const encodedMsg = encodeURIComponent(message);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const url = isIOS 
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`
        : `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
      <AnimatePresence>
        {isCustomDietModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCustomDietModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-md bg-[#faf8f5] rounded-[28px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-black border border-white/20 z-10"
            >
              {/* Header with requested color #00753A */}
              <div 
                className="p-5 sm:p-6 text-white flex items-center justify-between"
                style={{ backgroundColor: '#00753A' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0">
                    <Sparkles size={20} className="stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-serif font-black tracking-tight leading-tight text-white">
                      Sua dieta do seu jeito!
                    </h2>
                    <p className="text-xs text-white/90 font-medium">
                      Plano sob medida feito para você
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsCustomDietModalOpen(false)} 
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all cursor-pointer shrink-0"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>
              
              {/* Content matching Image 2 */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
                {/* Card 1: Nutricionista */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#dcfce7] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <Check size={20} className="text-[#16a34a] stroke-[3]" />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-800 font-medium leading-relaxed">
                    Já tem um plano alimentar feito pela sua nutricionista? Nós preparamos exatamente como está no seu cardápio.
                  </p>
                </div>

                {/* Card 2: Montar dieta */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs flex items-start sm:items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#fef3c7] flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <Star size={18} className="text-[#d97706] fill-[#d97706]" />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-800 font-medium leading-relaxed">
                    Se precisa de ajuda para montar uma dieta sob medida, também montamos para você! Fale conosco no WhatsApp.
                  </p>
                </div>

                {/* WhatsApp Action Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCustomDietWhatsApp}
                    className="w-full py-4 px-6 rounded-2xl font-black text-xs sm:text-sm tracking-wide uppercase text-white shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 bg-[#22c55e] hover:bg-[#16a34a]"
                  >
                    <MessageCircle size={22} className="fill-white text-white" />
                    <span>FALAR CONOSCO NO WHATSAPP</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }

  function renderDetoxModal() {
    return (
      <AnimatePresence>
        {isDetoxModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetoxModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-black border border-white/20"
            >
              {/* Header with requested color #4b6757 */}
              <div 
                className="p-5 sm:p-6 text-white flex items-center justify-between"
                style={{ backgroundColor: '#4b6757' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                    <Leaf size={18} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold uppercase tracking-wider leading-tight">
                      INSTRUÇÕES KIT DETOX
                    </h2>
                    <p className="text-[11px] text-white/80 font-medium">Guia completo para o seu protocolo detox</p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsDetoxModalOpen(false)} 
                  className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-all text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
              
              {/* Content with exact points from Images 2 & 3 */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm">
                
                {/* 1. Orientação de armazenamento */}
                <div className="bg-[#4b6757]/5 p-4 rounded-2xl border border-[#4b6757]/15 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-[#4b6757] text-xs uppercase tracking-wider">
                    <Snowflake size={15} />
                    <span>1. Orientação de Armazenamento:</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                    Manter todos os produtos no freezer a <strong>-18° ou menos</strong>.<br />
                    Retirar apenas o que for consumir no dia.
                  </p>
                </div>

                {/* 2. Orientação de consumo diário */}
                <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 space-y-2.5">
                  <div className="flex items-center gap-2 font-extrabold text-emerald-800 text-xs uppercase tracking-wider">
                    <Clock size={15} className="text-emerald-700" />
                    <span>2. Orientação de Consumo Diário:</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-gray-800 font-medium pl-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#4b6757]" />
                      <span><strong>Desjejum:</strong> Suco verde detox</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span><strong>Lanche da manhã:</strong> Suco vermelho detox</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#f09249]" />
                      <span><strong>Almoço:</strong> 1 refeição</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span><strong>Lanche da tarde:</strong> Suco amarelo detox</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-600" />
                      <span><strong>Jantar:</strong> 1 sopa/creme</span>
                    </div>
                  </div>
                </div>

                {/* 3. Orientação de preparo dos sucos detox */}
                <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-amber-800 text-xs uppercase tracking-wider">
                    <Sparkles size={15} className="text-amber-600" />
                    <span>3. Orientação de Preparo dos Sucos Detox:</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                    Bater no liquidificador ou diluir em um copo a polpa concentrada em <strong>até 300ml de água ou água de coco</strong>.
                  </p>
                </div>

                {/* 4. Orientação para aquecimento das refeições */}
                <div className="bg-orange-500/5 p-4 rounded-2xl border border-orange-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-orange-800 text-xs uppercase tracking-wider">
                    <Flame size={15} className="text-orange-600" />
                    <span>4. Orientação para Aquecimento das Refeições:</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                    Micro-ondas de <strong>6 a 8 minutos</strong>.
                  </p>
                </div>

                {/* 5. Orientação para aquecimento das sopas/cremes */}
                <div className="bg-teal-500/5 p-4 rounded-2xl border border-teal-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-teal-800 text-xs uppercase tracking-wider">
                    <Utensils size={15} className="text-teal-600" />
                    <span>5. Orientação para Aquecimento das Sopas/Cremes:</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                    Micro-ondas <strong>10 minutos</strong> OU remover da embalagem e aquecer diretamente em uma panela com um pouco de água.
                  </p>
                </div>

                {/* 6. O que não consumir durante o detox */}
                <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-rose-800 text-xs uppercase tracking-wider">
                    <Ban size={15} className="text-rose-600" />
                    <span>6. O que NÃO consumir durante o Detox:</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                    Álcool, industrializados, produtos com glúten, lactose ou açúcar. Idealmente não ingerir nenhum ingrediente de origem animal (carnes, ovos, leite, manteiga etc).
                  </p>
                </div>

                {/* 7. O que posso consumir além dos itens do KIT DETOX? */}
                <div className="bg-green-500/5 p-4 rounded-2xl border border-green-500/20 space-y-1.5">
                  <div className="flex items-center gap-2 font-extrabold text-green-800 text-xs uppercase tracking-wider">
                    <Apple size={15} className="text-green-600" />
                    <span>7. O que posso consumir além dos itens do KIT DETOX?</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed font-medium">
                    Caso sinta fome você pode adicionar <strong>frutas, verduras e castanhas</strong> entre as refeições.
                  </p>
                </div>

              </div>

              {/* Footer CTA */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetoxModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-md cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                  style={{ backgroundColor: '#4b6757' }}
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
  function unused_old_modal() {
    return (
      <AnimatePresence>
        {isDietsModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDietsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#ece6db] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] force-dark-headings text-black"
            >
              <div className="p-6 border-b border-gray-200/50 flex items-center justify-between bg-white/40 font-serif">
                <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2" style={{ color: settings.primaryColor || '#000000' }}>
                  <Building2 size={24} />
                  {'EMPRESAS & ATACADO'}
                </h2>
                <button 
                  onClick={() => setIsDietsModalOpen(false)} 
                  className="p-2 hover:bg-white/50 rounded-full transition-all text-black cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="bg-white/50 p-4 rounded-2xl border border-white/40 space-y-2">
                  <p className="text-[11px] font-semibold leading-relaxed text-black/80">
                    💡 Portal de agendamento e cotação de atacado corporativo. Faça pedidos no atacado diretamente sem intermediários! Condições personalizadas conforme volume.
                  </p>
                  
                  {isReturningB2b && (
                    <div className="flex items-center justify-between bg-[#865d39]/10 p-2.5 rounded-xl border border-[#865d39]/20 text-xs mt-1.5">
                      <span className="font-bold text-[#865d39]">✓ Perfil de Parceiro Ativo</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          localStorage.removeItem('b2b_profile_save');
                          setB2bName('');
                          setB2bResponsibleName('');
                          setB2bPhone('');
                          setB2bAddress('');
                          setIsReturningB2b(false);
                          toast.info('Campos do perfil limpos.');
                        }}
                        className="text-[10px] font-extrabold text-red-600 bg-white px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50"
                      >
                        Redefinir Perfil
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Business Name (Nome Fantasia) with autocomplete dropdown */}
                  <div className="space-y-1 relative">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Building2 size={12} /> Nome Fantasia / Razão Social *
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Café Central, Restaurante ou Empresa"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bName}
                      onChange={e => {
                        const val = e.target.value;
                        setB2bName(val);
                        if (val.trim().length >= 2) {
                          const matched = b2bProfiles.filter(p => 
                            (p.name || '').toLowerCase().includes(val.toLowerCase()) || 
                            (p.phone || '').toLowerCase().includes(val.toLowerCase())
                          );
                          setB2bSearchResults(matched);
                          setShowB2bSearchDropdown(matched.length > 0);
                        } else {
                          setShowB2bSearchDropdown(false);
                        }
                      }}
                    />
                    
                    {showB2bSearchDropdown && b2bSearchResults.length > 0 && (
                      <div className="absolute top-[100%] left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-gray-100 p-1">
                        <div className="text-[9px] font-bold text-gray-400 uppercase p-1.5 tracking-wider bg-gray-50/50">
                          Perfis Recorrentes Encontrados (Clique para preencher):
                        </div>
                        {b2bSearchResults.map((profile, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full p-2.5 text-left text-xs text-black hover:bg-gray-100 flex flex-col gap-0.5 rounded-lg active:scale-95 transition-all text-black font-medium"
                            onClick={() => {
                              setB2bName(profile.name || '');
                              setB2bResponsibleName(profile.manager || '');
                              setB2bPhone(profile.phone || '');
                              setB2bAddress(profile.address || '');
                              setIsReturningB2b(true);
                              setShowB2bSearchDropdown(false);
                              toast.success(`Perfil de ${profile.name} preenchido automaticamente!`);
                            }}
                          >
                            <span className="font-bold text-black">{profile.name}</span>
                            <span className="text-[10px] text-gray-500 font-normal">Contato: {profile.manager} • Tel: {profile.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Responsible Person Manager Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <User size={12} /> Responsável / Gestor do Contato *
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: João da Silva"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bResponsibleName}
                      onChange={e => setB2bResponsibleName(e.target.value)}
                    />
                  </div>

                  {/* Contact Phone */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Phone size={12} /> Telefone / WhatsApp Comercial *
                    </label>
                    <input 
                      type="tel" 
                      placeholder="(99) 99999-9999"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bPhone}
                      onChange={e => setB2bPhone(e.target.value)}
                    />
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <MapPin size={12} /> Endereço Comercial de Entrega *
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ex: Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold shadow-sm focus:border-black transition-colors"
                      value={b2bAddress}
                      onChange={e => setB2bAddress(e.target.value)}
                    />
                  </div>

                  {/* Delivery Schedule Frequency */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black block mb-1">
                      🚚 Plano de Entrega / Frequência *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button" 
                        onClick={() => setB2bFrequency('one-time')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${b2bFrequency === 'one-time' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-gray-300 text-black hover:border-black'}`}
                      >
                        <span>Entrega Única</span>
                        <span className="text-[9px] opacity-75 font-normal">Pedido Avulso</span>
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setB2bFrequency('weekly')}
                        className={`p-3 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1 ${b2bFrequency === 'weekly' ? 'bg-black text-white border-black shadow-md' : 'bg-white border-gray-300 text-black hover:border-black'}`}
                      >
                        <span className={b2bFrequency === 'weekly' ? "text-yellow-300" : "text-amber-600"}>★ Plano Semanal</span>
                        <span className="text-[9px] opacity-75 font-normal">Entregas recorrentes</span>
                      </button>
                    </div>
                  </div>

                  {/* Delivery Calendar (Data de entrega) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black flex items-center gap-1.5">
                      <Calendar size={12} className="text-[#865d39]" /> 
                      Data Programada para Entrega (Calendário) *
                    </label>
                    <input 
                      type="date" 
                      className="w-full p-3 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-extrabold text-black active:border-black select-all"
                      style={{ color: '#000000' }}
                      value={b2bDate}
                      onChange={e => setB2bDate(e.target.value)}
                    />
                  </div>

                  {/* Quantity section */}
                  <div className="pt-2">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#865d39] block mb-3 border-b border-[#865d39]/20 pb-1">
                      📦 VOLUME DE PACOTES DE PÃO DE QUEIJO CONGELADO (PACOTES DE 1KG)
                    </label>
                    
                    <div className="space-y-3">
                      {/* Item 1 */}
                      <div className="bg-white/70 p-3 rounded-2xl border border-white/30 flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div>
                          <h4 className="font-extrabold text-xs text-black">Pão de Queijo Coquetel Congelado</h4>
                          <p className="text-[10px] text-gray-500 font-semibold">Pacote de 1kg • Tamanho coquetel, ideal para cafés e eventos</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPqCoquetel(prev => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-black active:scale-90 transition-all font-extrabold cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-black">{pqCoquetel}</span>
                          <button 
                            type="button"
                            onClick={() => setPqCoquetel(prev => prev + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 hover:opacity-90 transition-all font-extrabold cursor-pointer"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div className="bg-white/70 p-3 rounded-2xl border border-white/30 flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div>
                          <h4 className="font-extrabold text-xs text-black">Pão de Queijo Médio Congelado</h4>
                          <p className="text-[10px] text-gray-500 font-semibold">Pacote de 1kg • Tamanho clássico tradicional de lanchonete</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPqMedio(prev => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-black active:scale-90 transition-all font-extrabold cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-black">{pqMedio}</span>
                          <button 
                            type="button"
                            onClick={() => setPqMedio(prev => prev + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 hover:opacity-90 transition-all font-extrabold cursor-pointer"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Item 3 */}
                      <div className="bg-white/70 p-3 rounded-2xl border border-white/30 flex items-center justify-between shadow-sm hover:shadow transition-shadow">
                        <div>
                          <h4 className="font-extrabold text-xs text-black">Pão de Queijo Grande Especial Congelado</h4>
                          <p className="text-[10px] text-gray-500 font-semibold">Pacote de 1kg • Tamanho grande especial para vitrine gourmet</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            onClick={() => setPqPremium(prev => Math.max(0, prev - 1))}
                            className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-black active:scale-90 transition-all font-extrabold cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-xs font-black text-black">{pqPremium}</span>
                          <button 
                            type="button"
                            onClick={() => setPqPremium(prev => prev + 1)}
                            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-90 hover:opacity-90 transition-all font-extrabold cursor-pointer"
                            style={{ backgroundColor: settings.primaryColor || '#865d39', color: getContrastText(settings.primaryColor || '#865d39') }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observation box */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-black">Observações / Detalhes de Acesso e Entrega</label>
                    <textarea 
                      placeholder="Ex: Instruções de acesso à doca, horários de recebimento ou solicitações especiais..."
                      rows={2.5}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs outline-none text-black font-semibold resize-none"
                      value={b2bObservation}
                      onChange={e => setB2bObservation(e.target.value)}
                    />
                  </div>
                </div>

                {/* Submission Options (Whats Only) */}
                <div className="pt-4 border-t border-gray-200/50 space-y-3">
                  <div className="text-[10px] font-extrabold text-center text-gray-500 uppercase tracking-widest">
                    Enviar Solicitação de Orçamento no Atacado:
                  </div>
                  
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={() => {
                        // Submit via WhatsApp
                        if (!b2bName.trim() || !b2bResponsibleName.trim() || !b2bPhone.trim() || !b2bAddress.trim() || !b2bDate) {
                           toast.error('Por favor, preencha todos os campos com asterisco (*).');
                           return;
                        }
                        if (pqCoquetel === 0 && pqMedio === 0 && pqPremium === 0) {
                           toast.error('Selecione a quantidade de pelo menos um pacote.');
                           return;
                        }
                        
                        // Construct state map and trigger submitting method
                        const formattedDateForDb = (() => {
                          const [year, month, day] = b2bDate.split('-');
                          return `${month}/${day}/${year}`;
                        })();

                        const orderItems = [];
                        if (pqCoquetel > 0) orderItems.push({ title: 'Pão de Queijo Coquetel Congelado (Pacote de 1kg)', quantity: pqCoquetel, price: 0, priceType: 'consult' as const });
                        if (pqMedio > 0) orderItems.push({ title: 'Pão de Queijo Médio Congelado (Pacote de 1kg)', quantity: pqMedio, price: 0, priceType: 'consult' as const });
                        if (pqPremium > 0) orderItems.push({ title: 'Pão de Queijo Grande Especial Congelado (Pacote de 1kg)', quantity: pqPremium, price: 0, priceType: 'consult' as const });

                        const b2bOrderDataObj = {
                          customerName: b2bName,
                          phone: b2bPhone,
                          address: b2bAddress,
                          pickupDate: formattedDateForDb,
                          birthday: '',
                          observation: b2bObservation,
                          email: '',
                          items: orderItems,
                          total: 0,
                          createdAt: serverTimestamp(),
                          orderLanguage: 'pt',
                          isB2B: true,
                          isPJ: true,
                          b2bManagerName: b2bResponsibleName,
                          b2bFrequency: b2bFrequency,
                          b2bCompanyName: b2bName,
                          b2bAddress: b2bAddress
                        };

                        try {
                          addDoc(collection(db, 'pedidos'), b2bOrderDataObj);
                          localStorage.setItem('b2b_profile_save', JSON.stringify({
                            name: b2bName,
                            manager: b2bResponsibleName,
                            phone: b2bPhone,
                            address: b2bAddress
                          }));
                          setIsReturningB2b(true);

                          // Build message
                          let msg = `*PEDIDO CORPORATIVO E COTAÇÃO DE ATACADO*\n`;
                          msg += `----------------------------------------\n`;
                          msg += `*Empresa:* ${b2bName}\n`;
                          msg += `*Responsável:* ${b2bResponsibleName}\n`;
                          msg += `*Telefone:* ${b2bPhone}\n`;
                          msg += `*Endereço:* ${b2bAddress}\n`;
                          msg += `*Frequência:* ${b2bFrequency === 'weekly' ? 'Plano Recorrente Semanal' : 'Pedido de Entrega Única'}\n`;
                          msg += `*Data de Entrega:* ${formattedDateForDb}\n\n`;
                          msg += `*Itens solicitados no atacado:*\n`;
                          if (pqCoquetel > 0) msg += `- Pão de Queijo Coquetel Congelado: ${pqCoquetel} pacote(s) de 1kg\n`;
                          if (pqMedio > 0) msg += `- Pão de Queijo Médio Congelado: ${pqMedio} pacote(s) de 1kg\n`;
                          if (pqPremium > 0) msg += `- Pão de Queijo Grande Especial Congelado: ${pqPremium} pacote(s) de 1kg\n`;
                          if (b2bObservation) msg += `\n*Observações/Instruções:* ${b2bObservation}\n`;
                          msg += `----------------------------------------\n`;
                          msg += `Olá! Gostaríamos de solicitar valores no atacado e agendamento de entrega. Obrigado!`;

                          const cleanPhone = getCleanWhatsAppPhone(settings.whatsappNumber || '');
                          const sendUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
                          
                          toast.success('Cotação corporativa registrada! Redirecionando para o WhatsApp...');
                          setIsDietsModalOpen(false);

                          try {
                            const win = window.open(sendUrl, '_blank');
                            if (!win || win.closed || typeof win.closed === 'undefined') {
                              window.location.href = sendUrl;
                            }
                          } catch (e) {
                            window.location.href = sendUrl;
                          }
                        } catch (err) {
                          console.error(err);
                          toast.error('Erro ao registrar o pedido.');
                        }
                      }}
                      className="w-full py-4 px-4 rounded-xl font-bold text-sm tracking-wider uppercase text-white bg-green-600 hover:bg-green-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md border-0"
                    >
                      <MessageCircle size={18} /> Enviar por WhatsApp
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
}
