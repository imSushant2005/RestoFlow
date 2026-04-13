
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.TenantScalarFieldEnum = {
  id: 'id',
  slug: 'slug',
  businessName: 'businessName',
  description: 'description',
  logoUrl: 'logoUrl',
  coverImageUrl: 'coverImageUrl',
  primaryColor: 'primaryColor',
  accentColor: 'accentColor',
  cuisineType: 'cuisineType',
  businessType: 'businessType',
  address: 'address',
  city: 'city',
  phone: 'phone',
  email: 'email',
  website: 'website',
  instagramUrl: 'instagramUrl',
  currency: 'currency',
  currencySymbol: 'currencySymbol',
  taxRate: 'taxRate',
  timezone: 'timezone',
  isActive: 'isActive',
  plan: 'plan',
  planStartedAt: 'planStartedAt',
  planExpiresAt: 'planExpiresAt',
  trialEndsAt: 'trialEndsAt',
  businessHours: 'businessHours',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  gstin: 'gstin',
  fssai: 'fssai'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  email: 'email',
  employeeCode: 'employeeCode',
  clerkUserId: 'clerkUserId',
  passwordHash: 'passwordHash',
  mustChangePassword: 'mustChangePassword',
  securityQuestion: 'securityQuestion',
  securityAnswerHash: 'securityAnswerHash',
  role: 'role',
  preferredLanguage: 'preferredLanguage',
  avatarUrl: 'avatarUrl',
  isActive: 'isActive',
  lastLoginAt: 'lastLoginAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RefreshTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.StaffInviteScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  email: 'email',
  role: 'role',
  token: 'token',
  expiresAt: 'expiresAt',
  acceptedAt: 'acceptedAt',
  createdAt: 'createdAt'
};

exports.Prisma.CategoryScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  description: 'description',
  emoji: 'emoji',
  imageUrl: 'imageUrl',
  sortOrder: 'sortOrder',
  isVisible: 'isVisible',
  availFrom: 'availFrom',
  availUntil: 'availUntil',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MenuItemScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  categoryId: 'categoryId',
  name: 'name',
  description: 'description',
  price: 'price',
  compareAtPrice: 'compareAtPrice',
  images: 'images',
  isAvailable: 'isAvailable',
  isPopular: 'isPopular',
  isChefSpecial: 'isChefSpecial',
  isBestSeller: 'isBestSeller',
  isNew: 'isNew',
  isVeg: 'isVeg',
  isVegan: 'isVegan',
  isGlutenFree: 'isGlutenFree',
  spiceLevel: 'spiceLevel',
  allergens: 'allergens',
  calories: 'calories',
  prepTimeMinutes: 'prepTimeMinutes',
  sortOrder: 'sortOrder',
  tags: 'tags',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ModifierGroupScalarFieldEnum = {
  id: 'id',
  menuItemId: 'menuItemId',
  name: 'name',
  isRequired: 'isRequired',
  minSelections: 'minSelections',
  maxSelections: 'maxSelections',
  sortOrder: 'sortOrder'
};

exports.Prisma.ModifierScalarFieldEnum = {
  id: 'id',
  modifierGroupId: 'modifierGroupId',
  name: 'name',
  priceAdjustment: 'priceAdjustment',
  isDefault: 'isDefault',
  isAvailable: 'isAvailable',
  sortOrder: 'sortOrder'
};

exports.Prisma.OfferScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  title: 'title',
  description: 'description',
  offerType: 'offerType',
  discountValue: 'discountValue',
  imageUrl: 'imageUrl',
  bannerColor: 'bannerColor',
  menuItemIds: 'menuItemIds',
  minimumOrder: 'minimumOrder',
  isActive: 'isActive',
  startsAt: 'startsAt',
  endsAt: 'endsAt',
  usageCount: 'usageCount',
  maxUsage: 'maxUsage',
  createdAt: 'createdAt'
};

exports.Prisma.ZoneScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  color: 'color',
  sortOrder: 'sortOrder'
};

exports.Prisma.TableScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  zoneId: 'zoneId',
  name: 'name',
  capacity: 'capacity',
  seats: 'seats',
  occupiedSeats: 'occupiedSeats',
  shape: 'shape',
  status: 'status',
  positionX: 'positionX',
  positionY: 'positionY',
  qrCodeUrl: 'qrCodeUrl',
  qrSecret: 'qrSecret',
  currentOrderId: 'currentOrderId',
  currentSessionId: 'currentSessionId',
  isRoaming: 'isRoaming',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CustomerScalarFieldEnum = {
  id: 'id',
  phone: 'phone',
  name: 'name',
  email: 'email',
  isActive: 'isActive',
  deactivatedAt: 'deactivatedAt',
  anonymizedAt: 'anonymizedAt',
  createdAt: 'createdAt',
  lastSeenAt: 'lastSeenAt'
};

exports.Prisma.DiningSessionScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  tableId: 'tableId',
  customerId: 'customerId',
  partySize: 'partySize',
  sessionStatus: 'sessionStatus',
  source: 'source',
  openedAt: 'openedAt',
  closedAt: 'closedAt',
  isBillGenerated: 'isBillGenerated',
  billGeneratedAt: 'billGeneratedAt',
  attendedByUserId: 'attendedByUserId',
  attendedByName: 'attendedByName'
};

exports.Prisma.BillScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  sessionId: 'sessionId',
  invoiceNumber: 'invoiceNumber',
  subtotal: 'subtotal',
  taxAmount: 'taxAmount',
  discountAmount: 'discountAmount',
  totalAmount: 'totalAmount',
  paymentStatus: 'paymentStatus',
  paymentMethod: 'paymentMethod',
  paidAt: 'paidAt',
  generatedAt: 'generatedAt',
  businessName: 'businessName',
  businessAddress: 'businessAddress',
  gstin: 'gstin',
  fssai: 'fssai'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  tableId: 'tableId',
  diningSessionId: 'diningSessionId',
  orderNumber: 'orderNumber',
  orderType: 'orderType',
  status: 'status',
  placedBy: 'placedBy',
  subtotal: 'subtotal',
  taxAmount: 'taxAmount',
  discountAmount: 'discountAmount',
  totalAmount: 'totalAmount',
  customerName: 'customerName',
  customerPhone: 'customerPhone',
  specialInstructions: 'specialInstructions',
  estimatedPrepMins: 'estimatedPrepMins',
  acceptedAt: 'acceptedAt',
  preparingAt: 'preparingAt',
  readyAt: 'readyAt',
  servedAt: 'servedAt',
  completedAt: 'completedAt',
  cancelledAt: 'cancelledAt',
  cancellationReason: 'cancellationReason',
  hasReview: 'hasReview',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  menuItemId: 'menuItemId',
  name: 'name',
  description: 'description',
  imageUrl: 'imageUrl',
  unitPrice: 'unitPrice',
  quantity: 'quantity',
  totalPrice: 'totalPrice',
  selectedModifiers: 'selectedModifiers',
  specialNote: 'specialNote',
  isVeg: 'isVeg',
  createdAt: 'createdAt'
};

exports.Prisma.ReviewScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  orderId: 'orderId',
  diningSessionId: 'diningSessionId',
  customerId: 'customerId',
  serviceStaffUserId: 'serviceStaffUserId',
  overallRating: 'overallRating',
  foodRating: 'foodRating',
  serviceRating: 'serviceRating',
  comment: 'comment',
  tipAmount: 'tipAmount',
  serviceStaffName: 'serviceStaffName',
  isPublic: 'isPublic',
  createdAt: 'createdAt'
};

exports.Prisma.DailyAnalyticsScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  date: 'date',
  totalOrders: 'totalOrders',
  completedOrders: 'completedOrders',
  cancelledOrders: 'cancelledOrders',
  totalRevenue: 'totalRevenue',
  totalTax: 'totalTax',
  avgOrderValue: 'avgOrderValue',
  avgPrepTimeMins: 'avgPrepTimeMins',
  uniqueCustomers: 'uniqueCustomers',
  peakHour: 'peakHour',
  topItemId: 'topItemId',
  topItemName: 'topItemName',
  topItemRevenue: 'topItemRevenue',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.Plan = exports.$Enums.Plan = {
  FREE: 'FREE',
  STARTER: 'STARTER',
  GOLD: 'GOLD',
  PLATINUM: 'PLATINUM'
};

exports.UserRole = exports.$Enums.UserRole = {
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  KITCHEN: 'KITCHEN',
  WAITER: 'WAITER'
};

exports.OfferType = exports.$Enums.OfferType = {
  PERCENTAGE: 'PERCENTAGE',
  FIXED: 'FIXED',
  COMBO: 'COMBO',
  BOGO: 'BOGO'
};

exports.TableShape = exports.$Enums.TableShape = {
  ROUND: 'ROUND',
  SQUARE: 'SQUARE',
  RECTANGLE: 'RECTANGLE'
};

exports.TableStatus = exports.$Enums.TableStatus = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  ORDERING_OPEN: 'ORDERING_OPEN',
  KITCHEN_ACTIVE: 'KITCHEN_ACTIVE',
  AWAITING_BILL: 'AWAITING_BILL',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  CLEANING: 'CLEANING'
};

exports.SessionStatus = exports.$Enums.SessionStatus = {
  OPEN: 'OPEN',
  PARTIALLY_SENT: 'PARTIALLY_SENT',
  ACTIVE: 'ACTIVE',
  AWAITING_BILL: 'AWAITING_BILL',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
};

exports.OrderType = exports.$Enums.OrderType = {
  DINE_IN: 'DINE_IN',
  TAKEAWAY: 'TAKEAWAY',
  ROAMING: 'ROAMING'
};

exports.OrderStatus = exports.$Enums.OrderStatus = {
  NEW: 'NEW',
  ACCEPTED: 'ACCEPTED',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
};

exports.Prisma.ModelName = {
  Tenant: 'Tenant',
  User: 'User',
  RefreshToken: 'RefreshToken',
  StaffInvite: 'StaffInvite',
  Category: 'Category',
  MenuItem: 'MenuItem',
  ModifierGroup: 'ModifierGroup',
  Modifier: 'Modifier',
  Offer: 'Offer',
  Zone: 'Zone',
  Table: 'Table',
  Customer: 'Customer',
  DiningSession: 'DiningSession',
  Bill: 'Bill',
  Order: 'Order',
  OrderItem: 'OrderItem',
  Review: 'Review',
  DailyAnalytics: 'DailyAnalytics'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
