export interface Category {
  id: string;
  title: string;
  order: number;
  catalog?: 'catalog1' | 'catalog2' | 'catalog3' | 'catalog4' | 'both' | 'all' | 'catalog_b2b' | 'b2b';
}

export type PriceType = 'fixed' | 'starting' | 'consult';

export interface Side {
  id: string;
  name: string;
  price: number;
  type?: 'side' | 'swap';
}

export interface ProductSize {
  id: string;
  name: string;
  price: number;
  oldPrice?: number;
}

export interface DeliveryNeighborhood {
  id: string;
  name: string;
  fee: number;
}

export interface NutritionalInfo {
  servingSize?: string; // Porção (ex: 100g, 350g, 1 prato raso)
  servingsPerContainer?: string; // Porções por embalagem (ex: 1, 4)
  calories?: string; // Valor Energético (kcal)
  caloriesVd?: string; // % VD*
  carbs?: string; // Carboidratos (g)
  carbsVd?: string; // % VD*
  totalSugars?: string; // Açúcares totais (g)
  totalSugarsVd?: string; // % VD*
  addedSugars?: string; // Açúcares adicionados (g)
  addedSugarsVd?: string; // % VD*
  proteins?: string; // Proteínas (g)
  proteinsVd?: string; // % VD*
  totalFat?: string; // Gorduras Totais (g)
  totalFatVd?: string; // % VD*
  saturatedFat?: string; // Gorduras Saturadas (g)
  saturatedFatVd?: string; // % VD*
  transFat?: string; // Gorduras Trans (g)
  transFatVd?: string; // % VD*
  fiber?: string; // Fibra Alimentar (g)
  fiberVd?: string; // % VD*
  sodium?: string; // Sódio (mg)
  sodiumVd?: string; // % VD*
  carbohydrates?: string; // Compatibilidade anterior
}

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  oldPrice?: number;
  priceType?: PriceType;
  image: string; // Base64
  categoryId?: string;
  order?: number; // Sorting order within its category
  isMeal?: boolean;
  isCustomCake?: boolean;
  ingredients?: string; // Comma separated
  allowedSides?: string[]; // IDs of sides
  isActive?: boolean;
  hasSizes?: boolean;
  sizes?: ProductSize[];
  cakeGalleryId?: string; // Associated image gallery
  isCustomSandwich?: boolean; // Custom sandwich or tapioca with multiple fillings
  customFillings?: string; // Comma separated list of fillings
  isCombo?: boolean; // Combo item where customer selects up to comboQuantity flavors
  comboQuantity?: number; // Total number of individual items/meals in the combo (e.g. 5, 10, 20, 30, 40, 50, etc.)
  comboAllowedProductIds?: string[]; // IDs of products eligible for this combo
  isComboOnly?: boolean; // Disponível apenas para montagem de combo, ocultar prato avulso
  nutritionalInfo?: NutritionalInfo;
  trackStock?: boolean; // Se o produto tem controle de estoque / pronta entrega ativo
  stockQuantity?: number; // Quantidade de unidades disponíveis para pronta entrega
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  mealOptions?: {
    removals: string[];
    sides: Side[];
  };
  selectedSize?: ProductSize;
  cakeOptions?: {
    size?: string;
    dough?: string;
    fillings?: string[];
    topping?: string;
    topper?: string;
    styleNumber?: number; // Selected image style number from gallery
  };
  sandwichOptions?: {
    fillings: string[];
  };
  comboOptions?: {
    items: { productId: string; productTitle: string; quantity: number }[];
  };
}

export interface Order {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  street?: string;
  number?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  pickupDate?: string;
  deliveryOption?: 'delivery' | 'pickup';
  scheduledDate?: string;
  wantsReadyDelivery?: boolean;
  scheduledTime?: string;
  deliveryStatus?: 'pending' | 'delivered';
  deliveryNeighborhood?: string;
  deliveryFee?: number;
  birthday: string;
  observation: string;
  email: string;
  isB2B?: boolean;
  isPJ?: boolean;
  b2bCompanyName?: string;
  b2bAddress?: string;
  b2bManagerName?: string;
  b2bFrequency?: 'one-time' | 'weekly' | string;
  catalog?: string;
  items: {
    title: string;
    quantity: number;
    price: number;
    priceType?: PriceType;
    productId?: string;
    notes?: string;
    mealOptions?: {
      removals: string[];
      sides: Side[];
    };
    selectedSize?: ProductSize;
    cakeOptions?: {
      size?: string;
      dough?: string;
      fillings?: string[];
      topping?: string;
      topper?: string;
      styleNumber?: number; // Selected style image number from gallery
    };
    sandwichOptions?: {
      fillings: string[];
    };
    comboOptions?: {
      items: { productId: string; productTitle: string; quantity: number }[];
    };
  }[];
  total: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  createdAt: any;
  orderLanguage?: string;
  paymentStatus?: 'pending' | 'half' | 'full';
}

export interface ImageGallery {
  id: string;
  title: string;
  images: string[]; // maximum 6 base64 images
}

export interface Settings {
  logo: string;
  primaryColor: string;
  whatsappNumber: string;
  whatsappCountryCode?: string;
  slug: string;
  brandName: string;
  adminPassword?: string;
  slogan?: string;
  whatsappClosingMessage?: string;
  birthdayMessageTemplate?: string; // Custom birthday message body for WhatsApp
  backgroundImage?: string;
  glassColor?: string;
  textColor?: string;
  categoryTextColor?: string;
  language?: 'pt' | 'en';
  currency?: 'BRL' | 'USD';
  checkoutTitle?: string;
  infoBlock1Title?: string;
  infoBlock1Text?: string;
  infoBlock2Title?: string;
  infoBlock2Text?: string;
  // Instruction buttons on customer menu
  showDetoxInstructionsButton?: boolean;
  showStorageInstructionsButton?: boolean;
  showCustomDietButton?: boolean;
  storageInstructionsImage?: string;
  detoxInstructionsImage?: string;
  // Intro screen settings
  introEnabled?: boolean;
  introTitle?: string;
  introSubtitle?: string;
  introDescription?: string;
  introButtonText?: string;
  introBottomText?: string;
  // Catalog selector settings
  selectorEnabled?: boolean;
  selectorTitle?: string;
  selectorSubtitle?: string;
  catalog1Title?: string;
  catalog1Image?: string;
  catalog1Desc?: string;
  catalog1Slogan?: string;
  catalog1Active?: boolean;
  catalog2Title?: string;
  catalog2Image?: string;
  catalog2Desc?: string;
  catalog2Slogan?: string;
  catalog2Active?: boolean;
  catalog3Title?: string;
  catalog3Image?: string;
  catalog3Desc?: string;
  catalog3Slogan?: string;
  catalog3Active?: boolean;
  catalog4Title?: string;
  catalog4Image?: string;
  catalog4Desc?: string;
  catalog4Slogan?: string;
  catalog4Active?: boolean;
  // Custom Cake settings
  cakeSizes?: string[];
  cakeDoughs?: string[];
  cakeFillings?: string[];
  cakeFillingsMax?: number;
  cakeToppings?: string[];
  cakeToppers?: string[];
  // Fixed costs configurations
  fixedRent?: number;
  fixedInternet?: number;
  fixedElectricity?: number;
  fixedWater?: number;
  fixedGas?: number;
  fixedSistemas?: number;
  fixedMarketing?: number;
  fixedContabilidade?: number;
  fixedSalarios?: number;
  fixedMei?: number;
  customFixedCosts?: { label: string; amount: number }[];
  deliveryNeighborhoods?: DeliveryNeighborhood[];
  minOrderValue?: number; // Valor mínimo para pedido (R$)
}

export interface VariableCost {
  id: string;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
}

export interface SupplyItem {
  id: string;
  title: string;
  category: 'Embalagens' | 'Ingredientes' | 'Utensílios' | 'Equipamentos' | 'Outros' | string;
  description?: string;
  imageUrl?: string;
  purchaseUrl: string;
  createdAt?: string;
}

