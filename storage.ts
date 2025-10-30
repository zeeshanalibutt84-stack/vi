import {
  users, drivers, rides, systemSettings, promoCodes,
  rateSheets, commissionSettings, routePricing, vehicleTypePricing,
  fareByDistance, fareFlatRoutes, fareHourly, fareExtras,
  type User, type InsertUser, type Driver, type InsertDriver,
  type Ride, type InsertRide, type SystemSettings, type InsertSystemSettings,
  type PromoCode, type InsertPromoCode, type RateSheet, type InsertRateSheet,
  type CommissionSettings, type InsertCommissionSettings,
  type RoutePricing, type InsertRoutePricing,
  type VehicleTypePricing, type InsertVehicleTypePricing,
  type FareByDistance, type InsertFareByDistance,
  type FareFlatRoutes, type InsertFareFlatRoutes,
  type FareHourly, type InsertFareHourly,
  type FareExtras, type InsertFareExtras
} from "@shared/schema";
import bcrypt from "bcryptjs";
import { db, partnerApplications } from "./db";
import { eq, and } from "drizzle-orm";
import { emit } from './realtime'

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function emitFareEvent(event: string, data: unknown) {emit('rates', { event, data }) 
// ya topic aapka "rates" ho
console.log(`Emitted SSE event: ${event}`)
}

// ----------------------------
// 🔵 Realtime Ride/Driver Emit Helpers
// ----------------------------
function emitRide(event: string, data: any) {
  emit("rides", { event, data });
  console.log(`Realtime: Ride ${event}`, data?.id || "");
}

function emitDriver(event: string, data: any) {
  emit("drivers", { event, data });
  console.log(`Realtime: Driver ${event}`, data?.id || "");
}

export interface IStorage {
  // User operations
  validateUserCredentials(email: string, password: string): Promise<User | undefined>;
  getUser(id: number): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserRole(id: number, role: string): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  
  // Email verification
  updateUserEmailVerification(userId: number, isVerified: boolean): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  setPasswordResetToken(userId: number, token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  updateUserPassword(userId: number, newPassword: string): Promise<User | undefined>;
  
  // Driver operations
  getDriver(id: number): Promise<Driver | undefined>;
  getDriverByUserId(userId: number): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: number, updates: Partial<Driver>): Promise<Driver | undefined>;
  getAllDrivers(): Promise<Driver[]>;
  getAllDriversWithUsers(): Promise<any[]>;
  updateDriverKYCStatus(id: number, status: string, updates: any): Promise<Driver | undefined>;
  getOnlineDrivers(): Promise<Driver[]>;
  getDriverById(id: number): Promise<Driver | undefined>;
  getDriversByPartnerId(partnerId: number): Promise<Driver[]>;
  deleteDriver(id: number): Promise<boolean>;
  
  // Ride operations
  getRide(id: number): Promise<Ride | undefined>;
  createRide(ride: InsertRide): Promise<Ride>;
  updateRide(id: number, updates: Partial<Ride>): Promise<Ride | undefined>;
  getRidesByCustomer(customerId: number): Promise<Ride[]>;
  getRidesByDriver(driverId: number): Promise<Ride[]>;
  getPendingRides(): Promise<Ride[]>;
  getAllRides(): Promise<Ride[]>;
  
  // System settings
  getSystemSettings(): Promise<SystemSettings | undefined>;
  updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings | undefined>;
  
  // Promo codes
  getPromoCode(code: string): Promise<PromoCode | undefined>;
  createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode>;
  getAllPromoCodes(): Promise<PromoCode[]>;
  updatePromoCode(id: number, updates: Partial<PromoCode>): Promise<PromoCode | undefined>;
  
  // Rate management
  getRateSheetByCountry(country: string): Promise<RateSheet | undefined>;
  createRateSheet(rateSheet: InsertRateSheet): Promise<RateSheet>;
  getAllRateSheets(): Promise<RateSheet[]>;
  updateRateSheet(id: number, updates: Partial<RateSheet>): Promise<RateSheet | undefined>;
  
  // Commission settings
  getCommissionSettingsByCountry(country: string): Promise<CommissionSettings | undefined>;
  createCommissionSettings(settings: InsertCommissionSettings): Promise<CommissionSettings>;
  getAllCommissionSettings(): Promise<CommissionSettings[]>;
  updateCommissionSettings(id: number, updates: Partial<CommissionSettings>): Promise<CommissionSettings | undefined>;
  
  // Route pricing
  getRoutePricingByCountry(country: string): Promise<RoutePricing[]>;
  createRoutePricing(pricing: InsertRoutePricing): Promise<RoutePricing>;
  getAllRoutePricing(): Promise<RoutePricing[]>;
  updateRoutePricing(id: number, updates: Partial<RoutePricing>): Promise<RoutePricing | undefined>;
  
  // Vehicle type pricing
  getAllVehicleTypePricing(): Promise<VehicleTypePricing[]>;
  createVehicleTypePricing(pricing: InsertVehicleTypePricing): Promise<VehicleTypePricing>;
  updateVehicleTypePricing(id: number, updates: Partial<VehicleTypePricing>): Promise<VehicleTypePricing | undefined>;

  // Fare Management
  // Distance-based fares
  getFareByDistance(id: number): Promise<FareByDistance | undefined>;
  getAllFaresByDistance(): Promise<FareByDistance[]>;
  createFareByDistance(fare: InsertFareByDistance): Promise<FareByDistance>;
  updateFareByDistance(id: number, updates: Partial<FareByDistance>): Promise<FareByDistance | undefined>;
  deleteFareByDistance(id: number): Promise<boolean>;

  // Flat route fares
  getFareFlatRoute(id: number): Promise<FareFlatRoutes | undefined>;
  getAllFareFlatRoutes(): Promise<FareFlatRoutes[]>;
  createFareFlatRoute(fare: InsertFareFlatRoutes): Promise<FareFlatRoutes>;
  updateFareFlatRoute(id: number, updates: Partial<FareFlatRoutes>): Promise<FareFlatRoutes | undefined>;
  deleteFareFlatRoute(id: number): Promise<boolean>;

  // Hourly fares
  getFareHourly(id: number): Promise<FareHourly | undefined>;
  getAllFareHourly(): Promise<FareHourly[]>;
  createFareHourly(fare: InsertFareHourly): Promise<FareHourly>;
  updateFareHourly(id: number, updates: Partial<FareHourly>): Promise<FareHourly | undefined>;
  deleteFareHourly(id: number): Promise<boolean>;

  // Extra fares
  getFareExtra(id: number): Promise<FareExtras | undefined>;
  getAllFareExtras(): Promise<FareExtras[]>;
  createFareExtra(fare: InsertFareExtras): Promise<FareExtras>;
  updateFareExtra(id: number, updates: Partial<FareExtras>): Promise<FareExtras | undefined>;
  deleteFareExtra(id: number): Promise<boolean>;

  createPartnerApplication(input: {
  email: string; fullName: string; company?: string; website?: string;
  country?: string; payoutMethod?: string; description?: string;
}): Promise<any>;

getPendingPartnerApplications(): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private drivers: Map<number, Driver>;
  private rides: Map<number, Ride>;
  private systemSettings: SystemSettings | undefined;
  private promoCodes: Map<number, PromoCode>;
  private rateSheets: Map<number, RateSheet>;
  private commissionSettings: Map<number, CommissionSettings>;
  private routePricing: Map<number, RoutePricing>;
  private vehicleTypePricing: Map<number, VehicleTypePricing>;
  private fareByDistance: Map<number, FareByDistance>;
  private fareFlatRoutes: Map<number, FareFlatRoutes>;
  private fareHourly: Map<number, FareHourly>;
  private fareExtras: Map<number, FareExtras>;
  private currentUserId: number;
  private currentDriverId: number;
  private currentRideId: number;
  private currentPromoId: number;
  private currentRateSheetId: number;
  private currentCommissionId: number;
  private currentRouteId: number;
  private currentVehicleTypeId: number;
  private currentFareByDistanceId: number;
  private currentFareFlatRouteId: number;
  private currentFareHourlyId: number;
  private currentFareExtraId: number;

  constructor() {
    this.users = new Map();
    this.drivers = new Map();
    this.rides = new Map();
    this.promoCodes = new Map();
    this.rateSheets = new Map();
    this.commissionSettings = new Map();
    this.routePricing = new Map();
    this.vehicleTypePricing = new Map();
    this.fareByDistance = new Map();
    this.fareFlatRoutes = new Map();
    this.fareHourly = new Map();
    this.fareExtras = new Map();
    this.currentUserId = 1;
    this.currentDriverId = 1;
    this.currentRideId = 1;
    this.currentPromoId = 1;
    this.currentRateSheetId = 1;
    this.currentCommissionId = 1;
    this.currentRouteId = 1;
    this.currentVehicleTypeId = 1;
    this.currentFareByDistanceId = 1;
    this.currentFareFlatRouteId = 1;
    this.currentFareHourlyId = 1;
    this.currentFareExtraId = 1;
    
    // Initialize system settings
    this.systemSettings = {
      id: 1,
      baseFarePerKm: "1.50",
      commissionRate: "15.00",
      serviceTax: "8.50",
      premiumMultiplier: "1.50",
      surgeEnabled: true,
      maxSurgeMultiplier: "5.00",
      surgeThreshold: 80,
      bookingFee: "2.50",
      cancellationFee: "5.00",
      waitTimeRate: "0.50"
    };

    this.initializeDefaultData();
    
    // Create demo users directly
    this.createDemoUsersDirectly();
  }
// NEW: Save partner application
  async createPartnerApplication(input: {
    email: string;
    fullName: string;
    company?: string;
    website?: string;
    country?: string;
    payoutMethod?: string;
    description?: string;
  }) {
    const [row] = await db
      .insert(partnerApplications)
      .values({
        email: normalizeEmail(input.email),
        fullName: input.fullName.trim(),
        company: input.company || null,
        website: input.website || null,
        country: input.country || null,
        payoutMethod: input.payoutMethod || null,
        description: input.description || null,
        status: "pending",
      })
      .returning();
    return row;
  }

  // NEW: Admin list ke liye pending fetch
  async getPendingPartnerApplications() {
    return await db
      .select()
      .from(partnerApplications)
      .where(
        and(
          eq(partnerApplications.status, "pending"),
          eq(partnerApplications.archived, false)
        )
      );
  }
  private initializeDefaultData() {
    // Initialize rate sheets for different countries
    const franceRates: RateSheet = {
      id: this.currentRateSheetId++,
      country: "France",
      countryCode: "FR",
      currency: "EUR",
      currencySymbol: "€",
      baseRate: "35.00",
      perKmRate: "1.50",
      perMinuteRate: "0.50",
      minimumFare: "35.00",
      bookingFee: "2.50",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.rateSheets.set(franceRates.id, franceRates);

    // Commission settings for France
    const franceCommission: CommissionSettings = {
      id: this.currentCommissionId++,
      country: "France",
      driverCommissionPercent: "85.00",
      taxPercent: "20.00",
      platformFeePercent: "15.00",
      isActive: true,
      updatedAt: new Date()
    };
    this.commissionSettings.set(franceCommission.id, franceCommission);

    // Route pricing based on Paris rates from Excel
    const routes = [
      { from: "CDG", to: "PARIS", price: "70.00", baggage: "80.00" },
      { from: "ORLY", to: "PARIS", price: "50.00", baggage: "60.00" },
      { from: "Paris Gares", to: "PARIS", price: "35.00", baggage: "40.00" },
      { from: "Beauvais", to: "PARIS", price: "160.00", baggage: "170.00" },
      { from: "PARIS", to: "CDG", price: "70.00", baggage: "80.00" },
      { from: "PARIS", to: "ORLY", price: "50.00", baggage: "60.00" },
      { from: "PARIS", to: "Beauvais", price: "160.00", baggage: "170.00" }
    ];

    routes.forEach(route => {
      const routePricing: RoutePricing = {
        id: this.currentRouteId++,
        fromLocation: route.from,
        toLocation: route.to,
        country: "France",
        basePrice: route.price,
        capacity: 4,
        baggagePrice: "10.00",
        waitingTimeFree: 30,
        waitingTimeRate: "0.50",
        paidWaitingIncluded: 60,
        currency: "EUR",
        currencySymbol: "€",
        isActive: true
      };
      this.routePricing.set(routePricing.id, routePricing);
    });

    // Vehicle type pricing based on Excel sheet
    const vehicleTypes = [
      { type: "economy_4", name: "Economy 4", multiplier: "1.00", capacity: 4, description: "Standard 4-seater vehicle" },
      { type: "economy_5", name: "Economy 5", multiplier: "1.20", capacity: 5, description: "Comfortable 5-seater vehicle" },
      { type: "van_economy", name: "Van Economy", multiplier: "1.50", capacity: 8, description: "Spacious van for groups" },
      { type: "van_luxe", name: "Van Luxe", multiplier: "2.00", capacity: 8, description: "Luxury van with premium features" },
      { type: "business", name: "Business", multiplier: "2.50", capacity: 4, description: "Business class comfort" },
      { type: "executive", name: "Executive", multiplier: "3.00", capacity: 4, description: "Executive luxury service" }
    ];

    vehicleTypes.forEach(vehicle => {
      const vehicleTypePricing: VehicleTypePricing = {
        id: this.currentVehicleTypeId++,
        vehicleType: vehicle.type,
        displayName: vehicle.name,
        multiplier: vehicle.multiplier,
        description: `Premium ${vehicle.name} service`,
        capacity: vehicle.capacity,
        isActive: true
      };
      this.vehicleTypePricing.set(vehicleTypePricing.id, vehicleTypePricing);
    });
  }

  public createDemoUsersDirectly() {
    // Create admin user
    const adminUser: User = {
      id: this.currentUserId++,
      email: "admin@demo.com",
      password: bcrypt.hashSync("admin123", 10),
      name: "Admin User",
      phone: "+1234567890",
      role: "admin",
      profileImage: null,
      isActive: true,
      joinDate: new Date(),
      rating: null,
      totalRides: 0,
      emailVerified: true,
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
    };
    this.users.set(adminUser.id, adminUser);
    
    // Create customer user
    const customerUser: User = {
      id: this.currentUserId++,
      email: "customer@demo.com",
      password: bcrypt.hashSync("demo123", 10),
      name: "John Customer",
      phone: "+1987654321",
      role: "customer",
      profileImage: null,
      isActive: true,
      joinDate: new Date(),
      rating: null,
      totalRides: 0,
      emailVerified: true,
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
    };
    this.users.set(customerUser.id, customerUser);
    
    // Create driver user
    const driverUser: User = {
      id: this.currentUserId++,
      email: "driver@demo.com",
      password: bcrypt.hashSync("demo123", 10),
      name: "Mike Driver",
      phone: "+1122334455",
      role: "driver",
      profileImage: null,
      isActive: true,
      joinDate: new Date(),
      rating: "4.8",
      totalRides: 0,
      emailVerified: true,
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpiry: null,
    };
    this.users.set(driverUser.id, driverUser);
    
    // Create driver profile for demo driver
    const driverProfile: Driver = {
      id: this.currentDriverId++,
      userId: driverUser.id,
      licenseNumber: "DL123456789",
      vehicleType: "economy_4",
      vehicleModel: "Toyota Camry",
      vehicleColor: "Silver",
      plateNumber: "ABC123",
      isVerified: true,
      isOnline: false,
      currentLocation: null,
      country: "France",
      city: "Paris",
      carClass: "Berline Economy",
      totalEarnings: "127.50",
      documentsUploaded: true,
      baseRatePerKm: "1.50",
      tvaRate: "10.00",
      kycStatus: "pending",
      licenseDocumentUrl: "https://res.cloudinary.com/dxdaxmhvp/image/upload/v1734704306/vitecab-driver-docs/license_19_license_1734704306236.jpg",
      vehicleRegistrationUrl: "https://res.cloudinary.com/dxdaxmhvp/image/upload/v1734704306/vitecab-driver-docs/registration_19_registration_1734704306456.jpg",
      insuranceDocumentUrl: "https://res.cloudinary.com/dxdaxmhvp/image/upload/v1734704306/vitecab-driver-docs/insurance_19_insurance_1734704306678.jpg",
      vehiclePhotoUrl: "https://res.cloudinary.com/dxdaxmhvp/image/upload/v1734704306/vitecab-driver-docs/vehiclePhoto_19_vehiclePhoto_1734704306899.jpg",
      driverSelfieUrl: "https://res.cloudinary.com/dxdaxmhvp/image/upload/v1734704306/vitecab-driver-docs/driverPhoto_19_driverPhoto_1734704307123.jpg",
      backgroundCheckUrl: "https://res.cloudinary.com/dxdaxmhvp/image/upload/v1734704306/vitecab-driver-docs/background_19_background_1734704307345.pdf",
      faceMatchScore: "94.5",
      documentVerificationScore: "98.2",
      verificationDate: new Date("2024-12-20T10:30:00Z"),
      verificationNotes: "All documents verified successfully. High confidence match.",
      
      // Banking Details
      bankName: "Bank of America",
      accountNumber: "****1234",
      routingNumber: "021000021",
      accountHolderName: "Mike Driver",
      bankingVerified: true,
      
      // Manual KYC Fields
      manualKycStatus: "approved",
      manualKycReviewedBy: 1,
      manualKycReviewDate: new Date('2024-01-01'),
      manualKycNotes: "All documents verified and approved",
      identityVerified: true,
      addressVerified: true,
      vehicleVerified: true,
      backgroundCheckVerified: true,
      
      // Payment method fields
      paymentMethod: "bank_transfer",
      iban: "FR1420041010050500013M02606",
      bic: "CCBPFRPPXXX",
      paypalEmail: null,
      stripeAccountId: null,
    };
    this.drivers.set(driverProfile.id, driverProfile);
    
    // Create demo rides to show functionality
    this.createDemoRides(customerUser.id, driverUser.id);
  }

  private createDemoRides(customerId: number, driverId: number) {
    // Create a completed ride
    const completedRide: Ride = {
      id: this.currentRideId++,
      customerId,
      driverId,
      pickupLocation: "Downtown Business District",
      dropoffLocation: "International Airport",
      pickupCoords: null,
      dropoffCoords: null,
      country: "France",
      city: "Paris",
      status: "completed",
      fare: "24.50",
      baseFare: "20.00",
      surgeMultiplier: "1.15",
      distance: "15.2",
      vehicleType: "economy_4",
      rideType: "standard",
      scheduledTime: null,
      requestTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000), // Started 5 min after request
      endTime: new Date(Date.now() - 1 * 60 * 60 * 1000), // Ended 1 hour ago
      paymentMethod: "cash",
      customerRating: 5,
      driverRating: 4,
      customerFeedback: "Great driver, smooth ride!",
      driverFeedback: "Pleasant customer",
      tips: "2.50",
      tollCharges: "0.00",
      waitTime: 0,
      isScheduled: false,
      cancellationReason: null,
      estimatedDuration: 35,
      estimatedArrival: null,
      // Payment fields
      paymentIntentId: "pi_1234567890",
      paymentMethodType: "card",
      paymentStatus: "completed",
      paymentMethodDetails: { cardLast4: "1234", brand: "visa" }
    };
    this.rides.set(completedRide.id, completedRide);
    
    // Create an in-progress ride
    const activeRide: Ride = {
      id: this.currentRideId++,
      customerId,
      driverId,
      pickupLocation: "Central Mall",
      dropoffLocation: "University Campus",
      pickupCoords: null,
      dropoffCoords: null,
      country: "France",
      city: "Paris",
      status: "in_progress",
      fare: "12.25",
      baseFare: "10.00",
      surgeMultiplier: "1.20",
      distance: "8.1",
      vehicleType: "business",
      rideType: "standard",
      scheduledTime: null,
      requestTime: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
      startTime: new Date(Date.now() - 15 * 60 * 1000), // Started 15 min ago
      endTime: null,
      paymentMethod: "cash",
      customerRating: null,
      driverRating: null,
      customerFeedback: null,
      driverFeedback: null,
      tips: "0.00",
      tollCharges: "0.00",
      waitTime: 0,
      isScheduled: false,
      cancellationReason: null,
      estimatedDuration: 20,
      estimatedArrival: null,
      // Payment fields
      paymentIntentId: null,
      paymentMethodType: "cash",
      paymentStatus: "pending",
      paymentMethodDetails: null
    };
    this.rides.set(activeRide.id, activeRide);
    
    // Create a pending ride waiting for driver
    const pendingRide: Ride = {
      id: this.currentRideId++,
      customerId,
      driverId: null,
      pickupLocation: "Train Station",
      dropoffLocation: "Shopping Center",
      pickupCoords: null,
      dropoffCoords: null,
      country: "France",
      city: "Paris",
      status: "pending",
      fare: "8.75",
      baseFare: "8.00",
      surgeMultiplier: "1.00",
      distance: "5.8",
      vehicleType: "economy_4",
      rideType: "standard",
      scheduledTime: null,
      requestTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      startTime: null,
      endTime: null,
      paymentMethod: "cash",
      customerRating: null,
      driverRating: null,
      customerFeedback: null,
      driverFeedback: null,
      tips: "0.00",
      tollCharges: "0.00",
      waitTime: 0,
      isScheduled: false,
      cancellationReason: null,
      estimatedDuration: 15,
      estimatedArrival: null,
      // Payment fields
      paymentIntentId: null,
      paymentMethodType: "cash",
      paymentStatus: "pending",
      paymentMethodDetails: null
    };
    this.rides.set(pendingRide.id, pendingRide);
    
    // Create additional demo rides for different vehicle types and cities
    const executiveRide: Ride = {
      id: this.currentRideId++,
      customerId,
      driverId: null,
      pickupLocation: "Hotel Luxe",
      dropoffLocation: "Business Center",
      pickupCoords: null,
      dropoffCoords: null,
      country: "France",
      city: "Paris",
      status: "pending",
      fare: "35.00",
      baseFare: "30.00",
      surgeMultiplier: "1.00",
      distance: "8.5",
      vehicleType: "executive",
      rideType: "premium",
      scheduledTime: null,
      requestTime: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      startTime: null,
      endTime: null,
      paymentMethod: "card",
      customerRating: null,
      driverRating: null,
      customerFeedback: null,
      driverFeedback: null,
      tips: "0.00",
      tollCharges: "0.00",
      waitTime: 0,
      isScheduled: false,
      cancellationReason: null,
      estimatedDuration: 18,
      estimatedArrival: null,
      paymentIntentId: null,
      paymentMethodType: "card",
      paymentStatus: "pending",
      paymentMethodDetails: null
    };
    this.rides.set(executiveRide.id, executiveRide);

    // Van ride for testing
    const vanRide: Ride = {
      id: this.currentRideId++,
      customerId,
      driverId: null,
      pickupLocation: "Family Home",
      dropoffLocation: "Airport Terminal 2",
      pickupCoords: null,
      dropoffCoords: null,
      country: "France",
      city: "Paris",
      status: "pending",
      fare: "45.00",
      baseFare: "40.00",
      surgeMultiplier: "1.00",
      distance: "25.0",
      vehicleType: "van_economy",
      rideType: "standard",
      scheduledTime: null,
      requestTime: new Date(Date.now() - 8 * 60 * 1000), // 8 minutes ago
      startTime: null,
      endTime: null,
      paymentMethod: "cash",
      customerRating: null,
      driverRating: null,
      customerFeedback: null,
      driverFeedback: null,
      tips: "0.00",
      tollCharges: "0.00",
      waitTime: 0,
      isScheduled: false,
      cancellationReason: null,
      estimatedDuration: 40,
      estimatedArrival: null,
      paymentIntentId: null,
      paymentMethodType: "cash",
      paymentStatus: "pending",
      paymentMethodDetails: null
    };
    this.rides.set(vanRide.id, vanRide);

    // Different city ride for testing geographical filtering
    const lyonRide: Ride = {
      id: this.currentRideId++,
      customerId,
      driverId: null,
      pickupLocation: "Lyon Central Station",
      dropoffLocation: "Lyon Business District",
      pickupCoords: null,
      dropoffCoords: null,
      country: "France",
      city: "Lyon",
      status: "pending",
      fare: "15.00",
      baseFare: "12.00",
      surgeMultiplier: "1.00",
      distance: "6.2",
      vehicleType: "economy_4",
      rideType: "standard",
      scheduledTime: null,
      requestTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      startTime: null,
      endTime: null,
      paymentMethod: "cash",
      customerRating: null,
      driverRating: null,
      customerFeedback: null,
      driverFeedback: null,
      tips: "0.00",
      tollCharges: "0.00",
      waitTime: 0,
      isScheduled: false,
      cancellationReason: null,
      estimatedDuration: 15,
      estimatedArrival: null,
      paymentIntentId: null,
      paymentMethodType: "cash",
      paymentStatus: "pending",
      paymentMethodDetails: null
    };
    this.rides.set(lyonRide.id, lyonRide);
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));
  return user && user.emailVerified ? user : undefined;
}

  async createUser(insertUser: InsertUser): Promise<User> {
  const hashedPassword = await bcrypt.hash(insertUser.password, 10);
  const emailVerificationToken = this.generateToken();

  const [user] = await db
    .insert(users)
    .values({
      name: insertUser.name,
      email: normalizeEmail(insertUser.email), // 👈 lower-case
      phone: insertUser.phone || null,
      password: hashedPassword,
      role: insertUser.role || "customer",
      profileImage: insertUser.profileImage || null,
      emailVerified: false,
      emailVerificationToken,
      passwordResetToken: null,
      passwordResetExpiry: null,
      // agar tumhare schema me timestamps hain to uncomment:
      // createdAt: new Date(),
      // updatedAt: new Date(),
    })
    .returning();

  return user!;
}

  // Email verification methods
  async updateUserEmailVerification(userId: number, isVerified: boolean): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      emailVerified: isVerified,
      emailVerificationToken: isVerified ? null : user.emailVerificationToken,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.emailVerificationToken === token);
  }

  async setPasswordResetToken(userId: number, token: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      passwordResetToken: token,
      passwordResetExpiry: new Date(Date.now() + 3600000), // 1 hour
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const user = Array.from(this.users.values()).find(u => u.passwordResetToken === token);
    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return undefined;
    }
    return user;
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updatedUser = {
      ...user,
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const validRoles = ["customer", "driver", "admin", "partner"];
    if (!validRoles.includes(role)) return undefined;
    
    const updatedUser = { ...user, role: role as "customer" | "driver" | "admin" | "partner" };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteUser(id: number): Promise<boolean> {
    // First, delete related data like driver profile if exists
    const driver = await this.getDriverByUserId(id);
    if (driver) {
      this.drivers.delete(driver.id);
    }

    // Delete user rides
    const userRides = Array.from(this.rides.values()).filter(
      ride => ride.customerId === id || ride.driverId === id
    );
    userRides.forEach(ride => this.rides.delete(ride.id));

    // Finally delete the user
    return this.users.delete(id);
  }

  // Driver operations
  async getDriver(id: number): Promise<Driver | undefined> {
    return this.drivers.get(id);
  }

  async getDriverByUserId(userId: number): Promise<Driver | undefined> {
  const driver = Array.from(this.drivers.values()).find(d => d.userId === userId);
  if (!driver) return undefined;

  const countryName = (driver.country || "France").toLowerCase();
  const countryCode =
    (driver as any).countryCode ||
    (countryName.includes("france") ? "FR" :
     countryName.includes("spain")  ? "ES" :
     countryName.includes("germany")? "DE" :
     countryName.includes("italy")  ? "IT" :
     countryName.includes("portugal")? "PT" :
     countryName.includes("netherlands")? "NL" :
     countryName.includes("belgium")? "BE" :
     countryName.includes("ireland")? "IE" :
     countryName.includes("united kingdom") || countryName.includes("uk") ? "GB" :
     countryName.includes("poland") ? "PL" : "FR");

  const currency =
    (driver as any).currency ||
    (countryCode === "GB" ? "GBP" : countryCode === "PL" ? "PLN" : "EUR");

  return {
    ...driver,
    countryCode,
    currency,
    verificationStatus: (driver as any).kycStatus,
    documents: {
      license:            (driver as any).licenseDocumentUrl,
      registration:       (driver as any).vehicleRegistrationUrl,
      insurance:          (driver as any).insuranceDocumentUrl,
      vehiclePhoto:       (driver as any).vehiclePhotoUrl,
      selfie:             (driver as any).driverSelfieUrl,
    },
    bankingVerified: !!(driver as any).bankingVerified,
  } as Driver;
}


  async createDriver(insertDriver: InsertDriver): Promise<Driver> {
    const id = this.currentDriverId++;
    const driver: Driver = {
      id,
      userId: insertDriver.userId,
      licenseNumber: insertDriver.licenseNumber,
      vehicleType: insertDriver.vehicleType,
      vehicleModel: insertDriver.vehicleModel,
      vehicleColor: insertDriver.vehicleColor,
      plateNumber: insertDriver.plateNumber,
      isVerified: false,
      isOnline: false,
      currentLocation: insertDriver.currentLocation || null,
      country: insertDriver.country || "France",
      city: insertDriver.city || "Paris",
      carClass: insertDriver.carClass || "Berline Economy",
      totalEarnings: "0.00",
      documentsUploaded: false,
      baseRatePerKm: insertDriver.baseRatePerKm || "1.50",
      tvaRate: insertDriver.tvaRate || "10.00",
      // KYC and Document Verification fields
      kycStatus: "pending",
      licenseDocumentUrl: null,
      vehicleRegistrationUrl: null,
      insuranceDocumentUrl: null,
      vehiclePhotoUrl: null,
      driverSelfieUrl: null,
      backgroundCheckUrl: null,
      faceMatchScore: null,
      documentVerificationScore: null,
      verificationDate: null,
      verificationNotes: null,
      
      // Banking Details
      bankName: null,
      accountNumber: null,
      routingNumber: null,
      accountHolderName: null,
      bankingVerified: false,
      
      // Manual KYC Fields
      manualKycStatus: "pending",
      manualKycReviewedBy: null,
      manualKycReviewDate: null,
      manualKycNotes: null,
      identityVerified: false,
      addressVerified: false,
      vehicleVerified: false,
      backgroundCheckVerified: false,
      
      // Payment method fields
      paymentMethod: "bank_transfer",
      iban: null,
      bic: null,
      paypalEmail: null,
      stripeAccountId: null,
    };
    this.drivers.set(id, driver);
    return driver;
  }

  async updateDriver(id: number, updates: Partial<Driver>): Promise<Driver | undefined> { 
  const driver = this.drivers.get(id);
  if (!driver) return undefined;
  
  const updatedDriver: Driver = { ...driver, ...updates };

  // --- AUTO flags (documents & KYC pending) ---
  const docKeys: (keyof Driver)[] = [
    "licenseDocumentUrl",
    "vehicleRegistrationUrl",
    "insuranceDocumentUrl",
    "vehiclePhotoUrl",
    "driverSelfieUrl",
  ];
  const vehicleKeys: (keyof Driver)[] = [
    "vehicleModel",
    "vehicleColor",
    "plateNumber",
    "licenseNumber",
  ];

  const touchedDoc = docKeys.some((k) => k in updates);
  const touchedVehicle = vehicleKeys.some((k) => k in updates);

  // 5/5 docs => documentsUploaded = true
  const allDocs = docKeys.every((k) => !!(updatedDriver as any)[k]);
  if (allDocs) {
    (updatedDriver as any).documentsUploaded = true;
  }

  // vehicle/doc change => kycStatus = "pending"
  if ((touchedDoc || touchedVehicle) && (updatedDriver as any).kycStatus !== "pending") {
    (updatedDriver as any).kycStatus = "pending";
  }
  // --- /AUTO flags ---

  this.drivers.set(id, updatedDriver);
  return updatedDriver;
}


  async getAllDrivers(): Promise<Driver[]> {
    return Array.from(this.drivers.values());
  }

  async getAllDriversWithUsers(): Promise<any[]> {
    const drivers = Array.from(this.drivers.values());
    return drivers.map(driver => {
      const user = this.users.get(driver.userId);
      return {
        ...driver,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage
        } : null,
        kycStatus: driver.kycStatus || "pending",
        documents: {
          driverLicense: driver.licenseDocumentUrl,
          vehicleRegistration: driver.vehicleRegistrationUrl,
          insurance: driver.insuranceDocumentUrl,
          vehiclePhoto: driver.vehiclePhotoUrl,
          driverSelfie: driver.driverSelfieUrl,
          backgroundCheck: driver.backgroundCheckUrl
        },
        submittedAt: new Date().toISOString()
      };
    });
  }

  async updateDriverKYCStatus(id: number, status: string, updates: any): Promise<Driver | undefined> {
    const driver = this.drivers.get(id);
    if (!driver) return undefined;

    const updatedDriver = { 
      ...driver, 
      kycStatus: status,
      isVerified: updates.isVerified ?? driver.isVerified,
      verificationNotes: updates.verificationNotes || driver.verificationNotes,
      manualKycReviewedBy: updates.reviewedBy || driver.manualKycReviewedBy,
      manualKycReviewDate: updates.reviewedAt || driver.manualKycReviewDate,
      documentVerificationScore: updates.verificationScore || driver.documentVerificationScore
    };
    
    this.drivers.set(id, updatedDriver);
    return updatedDriver;
  }

  async getOnlineDrivers(): Promise<Driver[]> {
    return Array.from(this.drivers.values()).filter(driver => driver.isOnline);
  }

  async getDriverById(id: number): Promise<Driver | undefined> {
    return this.drivers.get(id);
  }

  async getDriversByPartnerId(partnerId: number): Promise<Driver[]> {
    return Array.from(this.drivers.values())
      .filter(driver => driver.partnerId === partnerId)
      .map(driver => {
        const user = this.users.get(driver.userId);
        return {
          ...driver,
          user: user ? {
            name: user.name,
            email: user.email,
            phone: user.phone
          } : null
        };
      });
  }

  async deleteDriver(id: number): Promise<boolean> {
    const deleted = this.drivers.delete(id);
    return deleted;
  }

  // Ride operations
  async getRide(id: number): Promise<Ride | undefined> {
    return this.rides.get(id);
  }

  async createRide(insertRide: InsertRide): Promise<Ride> {
    const id = this.currentRideId++;
    const ride: Ride = {
      id,
      customerId: insertRide.customerId,
      driverId: insertRide.driverId || null,
      pickupLocation: insertRide.pickupLocation,
      dropoffLocation: insertRide.dropoffLocation,
      pickupCoords: insertRide.pickupCoords || null,
      dropoffCoords: insertRide.dropoffCoords || null,
      country: insertRide.country || "France",
      city: insertRide.city || "Paris",
      status: "pending",
      fare: insertRide.fare,
      baseFare: insertRide.baseFare,
      surgeMultiplier: insertRide.surgeMultiplier || "1.00",
      distance: insertRide.distance || null,
      vehicleType: insertRide.vehicleType || "economy_4",
      rideType: insertRide.rideType || "standard",
      scheduledTime: insertRide.scheduledTime || null,
      requestTime: new Date(),
      startTime: insertRide.startTime || null,
      endTime: insertRide.endTime || null,
      paymentMethod: insertRide.paymentMethod || "cash",
      customerRating: insertRide.customerRating || null,
      driverRating: insertRide.driverRating || null,
      customerFeedback: insertRide.customerFeedback || null,
      driverFeedback: insertRide.driverFeedback || null,
      tips: insertRide.tips || "0.00",
      tollCharges: insertRide.tollCharges || "0.00",
      waitTime: insertRide.waitTime || 0,
      isScheduled: insertRide.isScheduled || false,
      cancellationReason: insertRide.cancellationReason || null,
      estimatedDuration: insertRide.estimatedDuration || null,
      estimatedArrival: insertRide.estimatedArrival || null,
      // Payment Details
      paymentIntentId: insertRide.paymentIntentId || null,
      paymentMethodType: insertRide.paymentMethodType || "cash",
      paymentStatus: insertRide.paymentStatus || "pending",
      paymentMethodDetails: insertRide.paymentMethodDetails || null,
    };
    this.rides.set(id, ride);
    return ride;
  }

  async updateRide(id: number, updates: Partial<Ride>): Promise<Ride | undefined> {
    const ride = this.rides.get(id);
    if (!ride) return undefined;
    
    const updatedRide = { ...ride, ...updates };
    this.rides.set(id, updatedRide);
    return updatedRide;
  }

  async getRidesByCustomer(customerId: number): Promise<Ride[]> {
    return Array.from(this.rides.values())
      .filter(ride => ride.customerId === customerId)
      .sort((a, b) => new Date(b.requestTime).getTime() - new Date(a.requestTime).getTime());
  }

  async getRidesByDriver(driverId: number): Promise<Ride[]> {
    return Array.from(this.rides.values())
      .filter(ride => ride.driverId === driverId)
      .sort((a, b) => new Date(b.requestTime).getTime() - new Date(a.requestTime).getTime());
  }

  async getPendingRides(): Promise<Ride[]> {
    return Array.from(this.rides.values()).filter(ride => ride.status === "pending");
  }

  async getPendingRidesForDriver(driverCountry: string, driverCity: string, driverCarClass: string): Promise<Ride[]> {
    // Map car classes to vehicle types that the driver can handle
    const vehicleTypeMapping: { [key: string]: string[] } = {
      "Berline Economy": ["economy_4", "economy_5"],
      "Berline Executive": ["business", "executive", "economy_4", "economy_5"],
      "Van": ["van_economy", "van_luxe"],
      "Business Class": ["business", "executive", "economy_4", "economy_5"]
    };

    const compatibleVehicleTypes = vehicleTypeMapping[driverCarClass] || ["economy_4"];
    
    return Array.from(this.rides.values()).filter(ride => {
      // Basic status filter
      if (ride.status !== "pending") return false;
      
      // Vehicle type compatibility filter
      if (!compatibleVehicleTypes.includes(ride.vehicleType)) return false;
      
      // Geographical filtering - only show rides in driver's operational area
      if (ride.country !== driverCountry) return false;
      if (ride.city !== driverCity) return false;
      
      return true;
    });
  }

  async getAllRides(): Promise<Ride[]> {
    return Array.from(this.rides.values())
      .sort((a, b) => new Date(b.requestTime).getTime() - new Date(a.requestTime).getTime());
  }

  // System settings
  async getSystemSettings(): Promise<SystemSettings | undefined> {
    return this.systemSettings;
  }

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings | undefined> {
    if (!this.systemSettings) return undefined;
    
    this.systemSettings = { ...this.systemSettings, ...settings };
    return this.systemSettings;
  }

  // Promo codes
  async getPromoCode(code: string): Promise<PromoCode | undefined> {
    return Array.from(this.promoCodes.values()).find(promo => promo.code === code);
  }

  async createPromoCode(insertPromoCode: InsertPromoCode): Promise<PromoCode> {
    const id = this.currentPromoId++;
    const promoCode: PromoCode = {
      id,
      isActive: insertPromoCode.isActive ?? true,
      code: insertPromoCode.code,
      discountType: insertPromoCode.discountType,
      discountValue: insertPromoCode.discountValue,
      expiryDate: insertPromoCode.expiryDate || null,
      usageLimit: insertPromoCode.usageLimit || null,
      usedCount: 0
    };
    this.promoCodes.set(id, promoCode);
    return promoCode;
  }

  async getAllPromoCodes(): Promise<PromoCode[]> {
    return Array.from(this.promoCodes.values());
  }

  async updatePromoCode(id: number, updates: Partial<PromoCode>): Promise<PromoCode | undefined> {
    const promoCode = this.promoCodes.get(id);
    if (!promoCode) return undefined;
    
    const updatedPromoCode = { ...promoCode, ...updates };
    this.promoCodes.set(id, updatedPromoCode);
    return updatedPromoCode;
  }

  // Rate management methods
  async getRateSheetByCountry(country: string): Promise<RateSheet | undefined> {
    return Array.from(this.rateSheets.values()).find(sheet => sheet.country === country && sheet.isActive);
  }

  async createRateSheet(insertRateSheet: InsertRateSheet): Promise<RateSheet> {
    const id = this.currentRateSheetId++;
    const rateSheet: RateSheet = {
      id,
      country: insertRateSheet.country,
      countryCode: insertRateSheet.countryCode,
      currency: insertRateSheet.currency,
      currencySymbol: insertRateSheet.currencySymbol,
      baseRate: insertRateSheet.baseRate,
      perKmRate: insertRateSheet.perKmRate,
      perMinuteRate: insertRateSheet.perMinuteRate,
      minimumFare: insertRateSheet.minimumFare,
      bookingFee: insertRateSheet.bookingFee || "0.00",
      isActive: insertRateSheet.isActive !== undefined ? insertRateSheet.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.rateSheets.set(id, rateSheet);
    return rateSheet;
  }

  async getAllRateSheets(): Promise<RateSheet[]> {
    return Array.from(this.rateSheets.values());
  }

  async updateRateSheet(id: number, updates: Partial<RateSheet>): Promise<RateSheet | undefined> {
    const rateSheet = this.rateSheets.get(id);
    if (!rateSheet) return undefined;
    
    const updatedRateSheet = { ...rateSheet, ...updates, updatedAt: new Date() };
    this.rateSheets.set(id, updatedRateSheet);
    return updatedRateSheet;
  }

  // Commission settings methods
  async getCommissionSettingsByCountry(country: string): Promise<CommissionSettings | undefined> {
    return Array.from(this.commissionSettings.values()).find(settings => settings.country === country && settings.isActive);
  }

  async createCommissionSettings(insertCommissionSettings: InsertCommissionSettings): Promise<CommissionSettings> {
    const id = this.currentCommissionId++;
    const commissionSettings: CommissionSettings = {
      id,
      country: insertCommissionSettings.country,
      driverCommissionPercent: insertCommissionSettings.driverCommissionPercent || "85.00",
      taxPercent: insertCommissionSettings.taxPercent || "0.00",
      platformFeePercent: insertCommissionSettings.platformFeePercent || "15.00",
      isActive: insertCommissionSettings.isActive !== undefined ? insertCommissionSettings.isActive : true,
      updatedAt: new Date()
    };
    this.commissionSettings.set(id, commissionSettings);
    return commissionSettings;
  }

  async getAllCommissionSettings(): Promise<CommissionSettings[]> {
    return Array.from(this.commissionSettings.values());
  }

  async updateCommissionSettings(id: number, updates: Partial<CommissionSettings>): Promise<CommissionSettings | undefined> {
    const commissionSettings = this.commissionSettings.get(id);
    if (!commissionSettings) return undefined;
    
    const updatedCommissionSettings = { ...commissionSettings, ...updates, updatedAt: new Date() };
    this.commissionSettings.set(id, updatedCommissionSettings);
    return updatedCommissionSettings;
  }

  // Route pricing methods
  async getRoutePricingByCountry(country: string): Promise<RoutePricing[]> {
    return Array.from(this.routePricing.values()).filter(pricing => pricing.country === country && pricing.isActive);
  }

  async createRoutePricing(insertRoutePricing: InsertRoutePricing): Promise<RoutePricing> {
    const id = this.currentRouteId++;
    const routePricing: RoutePricing = {
      id,
      fromLocation: insertRoutePricing.fromLocation,
      toLocation: insertRoutePricing.toLocation,
      country: insertRoutePricing.country,
      basePrice: insertRoutePricing.basePrice,
      capacity: insertRoutePricing.capacity || 4,
      baggagePrice: insertRoutePricing.baggagePrice || null,
      waitingTimeFree: insertRoutePricing.waitingTimeFree || null,
      waitingTimeRate: insertRoutePricing.waitingTimeRate || null,
      paidWaitingIncluded: insertRoutePricing.paidWaitingIncluded || null,
      currency: insertRoutePricing.currency,
      currencySymbol: insertRoutePricing.currencySymbol,
      isActive: insertRoutePricing.isActive !== undefined ? insertRoutePricing.isActive : true
    };
    this.routePricing.set(id, routePricing);
    return routePricing;
  }

  async getAllRoutePricing(): Promise<RoutePricing[]> {
    return Array.from(this.routePricing.values());
  }

  async updateRoutePricing(id: number, updates: Partial<RoutePricing>): Promise<RoutePricing | undefined> {
    const routePricing = this.routePricing.get(id);
    if (!routePricing) return undefined;
    
    const updatedRoutePricing = { ...routePricing, ...updates };
    this.routePricing.set(id, updatedRoutePricing);
    return updatedRoutePricing;
  }

  // Vehicle type pricing methods
  async getAllVehicleTypePricing(): Promise<VehicleTypePricing[]> {
    return Array.from(this.vehicleTypePricing.values()).filter(pricing => pricing.isActive);
  }

  async createVehicleTypePricing(insertVehicleTypePricing: InsertVehicleTypePricing): Promise<VehicleTypePricing> {
    const id = this.currentVehicleTypeId++;
    const vehicleTypePricing: VehicleTypePricing = {
      id,
      vehicleType: insertVehicleTypePricing.vehicleType,
      displayName: insertVehicleTypePricing.displayName,
      multiplier: insertVehicleTypePricing.multiplier || "1.00",
      description: insertVehicleTypePricing.description || null,
      capacity: insertVehicleTypePricing.capacity || 4,
      isActive: insertVehicleTypePricing.isActive !== undefined ? insertVehicleTypePricing.isActive : true
    };
    this.vehicleTypePricing.set(id, vehicleTypePricing);
    return vehicleTypePricing;
  }

  async updateVehicleTypePricing(id: number, updates: Partial<VehicleTypePricing>): Promise<VehicleTypePricing | undefined> {
    const vehicleTypePricing = this.vehicleTypePricing.get(id);
    if (!vehicleTypePricing) return undefined;
    
    const updatedVehicleTypePricing = { ...vehicleTypePricing, ...updates };
    this.vehicleTypePricing.set(id, updatedVehicleTypePricing);
    return updatedVehicleTypePricing;
  }

  // Fare Management Methods
  // Distance-based fares
  async getFareByDistance(id: number): Promise<FareByDistance | undefined> {
    return this.fareByDistance.get(id);
  }

  async getAllFaresByDistance(): Promise<FareByDistance[]> {
    return Array.from(this.fareByDistance.values());
  }

  async createFareByDistance(fare: InsertFareByDistance): Promise<FareByDistance> {
    const id = this.currentFareByDistanceId++;
    const newFare: FareByDistance = {
      id,
      ...fare,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.fareByDistance.set(id, newFare);
    return newFare;
  }

  async updateFareByDistance(id: number, updates: Partial<FareByDistance>): Promise<FareByDistance | undefined> {
    const fare = this.fareByDistance.get(id);
    if (!fare) return undefined;
    
    const updatedFare = { ...fare, ...updates, updatedAt: new Date() };
    this.fareByDistance.set(id, updatedFare);
    return updatedFare;
  }

  async deleteFareByDistance(id: number): Promise<boolean> {
    return this.fareByDistance.delete(id);
  }

  // Flat route fares
  async getFareFlatRoute(id: number): Promise<FareFlatRoutes | undefined> {
    return this.fareFlatRoutes.get(id);
  }

  async getAllFareFlatRoutes(): Promise<FareFlatRoutes[]> {
    return Array.from(this.fareFlatRoutes.values());
  }

  async createFareFlatRoute(fare: InsertFareFlatRoutes): Promise<FareFlatRoutes> {
    const id = this.currentFareFlatRouteId++;
    const newFare: FareFlatRoutes = {
      id,
      vehicleType: fare.vehicleType,
      routeName: fare.routeName,
      fromLocation: fare.fromLocation,
      toLocation: fare.toLocation,
      price: fare.price,
      estimatedDuration: fare.estimatedDuration || 0,
      estimatedDistance: fare.estimatedDistance || "0",
      isActive: fare.isActive !== undefined ? fare.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.fareFlatRoutes.set(id, newFare);
    return newFare;
  }

  async updateFareFlatRoute(id: number, updates: Partial<FareFlatRoutes>): Promise<FareFlatRoutes | undefined> {
    const fare = this.fareFlatRoutes.get(id);
    if (!fare) return undefined;
    
    const updatedFare = { ...fare, ...updates, updatedAt: new Date() };
    this.fareFlatRoutes.set(id, updatedFare);
    return updatedFare;
  }

  async deleteFareFlatRoute(id: number): Promise<boolean> {
    return this.fareFlatRoutes.delete(id);
  }

  // Hourly fares
  async getFareHourly(id: number): Promise<FareHourly | undefined> {
    return this.fareHourly.get(id);
  }

  async getAllFareHourly(): Promise<FareHourly[]> {
    return Array.from(this.fareHourly.values());
  }

  async createFareHourly(fare: InsertFareHourly): Promise<FareHourly> {
    const id = this.currentFareHourlyId++;
    const newFare: FareHourly = {
      id,
      vehicleType: fare.vehicleType,
      pricePerHour: fare.pricePerHour,
      minimumHours: fare.minimumHours || 1,
      maximumHours: fare.maximumHours || 12,
      description: fare.description || null,
      isActive: fare.isActive !== undefined ? fare.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.fareHourly.set(id, newFare);
    return newFare;
  }

  async updateFareHourly(id: number, updates: Partial<FareHourly>): Promise<FareHourly | undefined> {
    const fare = this.fareHourly.get(id);
    if (!fare) return undefined;
    
    const updatedFare = { ...fare, ...updates, updatedAt: new Date() };
    this.fareHourly.set(id, updatedFare);
    return updatedFare;
  }

  async deleteFareHourly(id: number): Promise<boolean> {
    return this.fareHourly.delete(id);
  }

  // Extra fares
  async getFareExtra(id: number): Promise<FareExtras | undefined> {
    return this.fareExtras.get(id);
  }

  async getAllFareExtras(): Promise<FareExtras[]> {
    return Array.from(this.fareExtras.values());
  }

  async createFareExtra(fare: InsertFareExtras): Promise<FareExtras> {
    const id = this.currentFareExtraId++;
    const newFare: FareExtras = {
      id,
      item: fare.item,
      description: fare.description || null,
      price: fare.price,
      category: fare.category || "general",
      applicableVehicleTypes: fare.applicableVehicleTypes || "all",
      isActive: fare.isActive !== undefined ? fare.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.fareExtras.set(id, newFare);
    return newFare;
  }

  async updateFareExtra(id: number, updates: Partial<FareExtras>): Promise<FareExtras | undefined> {
    const fare = this.fareExtras.get(id);
    if (!fare) return undefined;
    
    const updatedFare = { ...fare, ...updates, updatedAt: new Date() };
    this.fareExtras.set(id, updatedFare);
    return updatedFare;
  }

  async deleteFareExtra(id: number): Promise<boolean> {
    return this.fareExtras.delete(id);
  }
}

// Database implementation
import { db } from "./db";
import { eq, and } from "drizzle-orm";

class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }
  async validateUserCredentials(email: string, password: string) {
  const normalized = normalizeEmail(email);
  const [u] = await db.select().from(users).where(eq(users.email, normalized));
  if (!u || !u.password) return undefined;
  // block until verified
  if (!u.emailVerified) return undefined;
  const ok = await bcrypt.compare(password, u.password);
  if (!ok) return undefined;
  delete (u as any).password;
  return u;
  }
  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const emailVerificationToken = this.generateToken();
    
    const [user] = await db
      .insert(users)
      .values({
        name: insertUser.name,
        email: insertUser.email,
        phone: insertUser.phone || null,
        password: hashedPassword,
        role: insertUser.role || "customer",
        profileImage: insertUser.profileImage || null,
        emailVerified: false,
        emailVerificationToken,
        isActive: true,
        joinDate: new Date(),
        rating: "0.00",
        totalRides: 0,
      })
      .returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const validRoles = ["customer", "driver", "admin", "partner"];
    if (!validRoles.includes(role)) return undefined;
    
    const [user] = await db
      .update(users)
      .set({ role: role as "customer" | "driver" | "admin" | "partner" })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // First, delete related data like driver profile if exists
      const [driver] = await db.select().from(drivers).where(eq(drivers.userId, id));
      if (driver) {
        await db.delete(drivers).where(eq(drivers.userId, id));
      }

      // Delete user rides
      await db.delete(rides).where(eq(rides.customerId, id));
      await db.delete(rides).where(eq(rides.driverId, id));

      // Finally delete the user
      const result = await db.delete(users).where(eq(users.id, id));
      return true; // If no exception thrown, deletion was successful
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Email verification methods
  async updateUserEmailVerification(userId: number, isVerified: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        emailVerified: isVerified,
        emailVerificationToken: isVerified ? null : users.emailVerificationToken
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
    return user || undefined;
  }

  async setPasswordResetToken(userId: number, token: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ 
        passwordResetToken: token,
        passwordResetExpiry: new Date(Date.now() + 3600000) // 1 hour
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user || undefined;
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<User | undefined> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const [user] = await db
      .update(users)
      .set({ 
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null
      })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  private generateToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  // Driver operations
  async getDriver(id: number): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }
  
  async getDriverByUserId(userId: number): Promise<Driver | undefined> {
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
  if (!driver) return undefined;

  // --- enrich for frontend ---
  const countryName = (driver.country || "France").toLowerCase();
  const countryCode =
    driver.countryCode ||
    (countryName.includes("france") ? "FR" :
     countryName.includes("spain")  ? "ES" :
     countryName.includes("germany")? "DE" :
     countryName.includes("italy")  ? "IT" :
     countryName.includes("portugal")? "PT" :
     countryName.includes("netherlands")? "NL" :
     countryName.includes("belgium")? "BE" :
     countryName.includes("ireland")? "IE" :
     countryName.includes("united kingdom") || countryName.includes("uk") ? "GB" :
     countryName.includes("poland") ? "PL" : "FR");

  const currency =
    driver.currency ||
    (countryCode === "GB" ? "GBP" : countryCode === "PL" ? "PLN" : "EUR");

  return {
    ...driver,
    countryCode,
    currency,
    verificationStatus: (driver as any).kycStatus,
    documents: {
      license:            (driver as any).licenseDocumentUrl,
      registration:       (driver as any).vehicleRegistrationUrl,
      insurance:          (driver as any).insuranceDocumentUrl,
      vehiclePhoto:       (driver as any).vehiclePhotoUrl,
      selfie:             (driver as any).driverSelfieUrl,
    },
    bankingVerified: !!(driver as any).bankingVerified,
  } as Driver;
}
  
  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [newDriver] = await db
      .insert(drivers)
      .values(driver)
      .returning();
    return newDriver;
  }
  
async updateDriver(id: number, updates: Partial<Driver>): Promise<Driver | undefined> {
  // 1) current row lao
  const [current] = await db.select().from(drivers).where(eq(drivers.id, id));
  if (!current) return undefined;

  // 2) merge view (current + incoming updates)
  const merged = { ...current, ...updates } as Driver;

  // 3) auto-flags compute
  const docKeys = [
    "licenseDocumentUrl",
    "vehicleRegistrationUrl",
    "insuranceDocumentUrl",
    "vehiclePhotoUrl",
    "driverSelfieUrl",
  ] as const;
  const vehicleKeys = [
    "vehicleModel",
    "vehicleColor",
    "plateNumber",
    "licenseNumber",
  ] as const;

  const touchedDoc = docKeys.some((k) => k in updates);
  const touchedVehicle = vehicleKeys.some((k) => k in updates);

  // all docs present?
  const allDocs = docKeys.every((k) => !!(merged as any)[k]);

  // 4) final updates object (only the fields we actually set)
  const finalUpdates: Partial<Driver> = { ...updates };

  if (allDocs && !(current as any).documentsUploaded) {
    (finalUpdates as any).documentsUploaded = true;
  }
  if ((touchedDoc || touchedVehicle) && (current as any).kycStatus !== "pending") {
    (finalUpdates as any).kycStatus = "pending";
  }

  // 5) write to DB, return updated row
  const [updated] = await db
    .update(drivers)
    .set(finalUpdates)
    .where(eq(drivers.id, id))
    .returning();

  // 👇 Realtime emit yahan add karo
  if (updated) {
    emitDriver("updated", updated);
    console.log("Realtime: Driver updated", updated.id);
  }

  return updated || undefined;
}

  async getAllDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers);
  }
  
  async getAllDriversWithUsers(): Promise<any[]> {
    const result = await db
      .select()
      .from(drivers)
      .leftJoin(users, eq(drivers.userId, users.id));
    return result.map(row => ({
      ...row.drivers,
      user: row.users
    }));
  }
  
  async updateDriverKYCStatus(id: number, status: string, updates: any): Promise<Driver | undefined> {
    const [driver] = await db
      .update(drivers)
      .set({ 
        kycStatus: status,
        ...updates 
      })
      .where(eq(drivers.id, id))
      .returning();
    return driver || undefined;
  }
  
  async getOnlineDrivers(): Promise<Driver[]> {
    return await db.select().from(drivers).where(eq(drivers.isOnline, true));
  }
  
  async getRide(id: number): Promise<Ride | undefined> { return undefined; }
  async createRide(ride: InsertRide): Promise<Ride> {const [newRide] = await db.insert(rides).values(ride).returning();
  emitRide("created", newRide);
  return newRide;
}
  async updateRide(id: number, updates: Partial<Ride>): Promise<Ride | undefined> {
  const [updatedRide] = await db.update(rides).set(updates).where(eq(rides.id, id)).returning();
  if (updatedRide) emitRide("updated", updatedRide);
  return updatedRide || undefined;
}
  async getRidesByCustomer(customerId: number): Promise<Ride[]> { return []; }
  async getRidesByDriver(driverId: number): Promise<Ride[]> {
  // DB se driver ki rides lao
  const rows = await db
    .select()
    .from(rides)
    .where(eq(rides.driverId, driverId));

  // safety + same sorting as memstorage (newest first)
  return (Array.isArray(rows) ? rows : []).sort((a: any, b: any) => {
    const ta = new Date(a.requestTime ?? a.endTime ?? a.createdAt ?? 0).getTime();
    const tb = new Date(b.requestTime ?? b.endTime ?? b.createdAt ?? 0).getTime();
    return tb - ta;
  }) as Ride[];
}

// === ADMIN CONTROL FUNCTIONS ===

// Admin manually ride assign kare kisi driver ko
async assignRideToDriver(rideId: number, driverId: number) {
  const [ride] = await db.update(rides)
    .set({ driverId, status: "assigned" })
    .where(eq(rides.id, rideId))
    .returning();

  if (ride) {
    emitRide("assigned", ride);
    emitDriver("updated", { id: driverId, assignedRide: ride.id });
    console.log("Realtime: Ride assigned", ride.id, "→ Driver", driverId);
  }

  return ride;
}

// Admin ride cancel kare
async cancelRideByAdmin(rideId: number, reason: string) {
  const [ride] = await db.update(rides)
    .set({ status: "cancelled", cancellationReason: reason })
    .where(eq(rides.id, rideId))
    .returning();

  if (ride) {
    emitRide("cancelled", ride);
    console.log("Realtime: Ride cancelled", ride.id);
  }

  return ride;
}

// Admin ride complete mark kare
async completeRideByAdmin(rideId: number) {
  const [ride] = await db.update(rides)
    .set({ status: "completed", endTime: new Date() })
    .where(eq(rides.id, rideId))
    .returning();

  if (ride) {
    emitRide("completed", ride);
    console.log("Realtime: Ride completed", ride.id);
  }

  return ride;
}

// Admin ride transfer kare (driver se kisi aur driver ko)
async transferRide(rideId: number, fromDriverId: number, toDriverId: number) {
  const [ride] = await db.update(rides)
    .set({ driverId: toDriverId, status: "reassigned" })
    .where(eq(rides.id, rideId))
    .returning();

  if (ride) {
    emitRide("reassigned", ride);
    emitDriver("updated", { id: fromDriverId, removedRide: ride.id });
    emitDriver("updated", { id: toDriverId, assignedRide: ride.id });
    console.log("Realtime: Ride transferred", ride.id, "→", toDriverId);
  }

  return ride;
}

  async getPendingRides(): Promise<Ride[]> { return []; }
  async getAllRides(): Promise<Ride[]> { return []; }
  
  async getSystemSettings(): Promise<SystemSettings | undefined> { return undefined; }
  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<SystemSettings | undefined> { return undefined; }
  
  async getPromoCode(code: string): Promise<PromoCode | undefined> { return undefined; }
  async createPromoCode(promoCode: InsertPromoCode): Promise<PromoCode> { throw new Error("Not implemented"); }
  async getAllPromoCodes(): Promise<PromoCode[]> { return []; }
  async updatePromoCode(id: number, updates: Partial<PromoCode>): Promise<PromoCode | undefined> { return undefined; }
  
  async getRateSheetByCountry(country: string): Promise<RateSheet | undefined> { return undefined; }
  async createRateSheet(rateSheet: InsertRateSheet): Promise<RateSheet> { throw new Error("Not implemented"); }
  async getAllRateSheets(): Promise<RateSheet[]> { return []; }
  async updateRateSheet(id: number, updates: Partial<RateSheet>): Promise<RateSheet | undefined> { return undefined; }
  
  async getCommissionSettingsByCountry(country: string): Promise<CommissionSettings | undefined> { return undefined; }
  async createCommissionSettings(settings: InsertCommissionSettings): Promise<CommissionSettings> { throw new Error("Not implemented"); }
  async getAllCommissionSettings(): Promise<CommissionSettings[]> { return []; }
  async updateCommissionSettings(id: number, updates: Partial<CommissionSettings>): Promise<CommissionSettings | undefined> { return undefined; }
  
  async getRoutePricingByCountry(country: string): Promise<RoutePricing[]> { return []; }
  async createRoutePricing(pricing: InsertRoutePricing): Promise<RoutePricing> { throw new Error("Not implemented"); }
  async updateRoutePricing(id: number, updates: Partial<RoutePricing>): Promise<RoutePricing | undefined> { return undefined; }
  async deleteRoutePricing(id: number): Promise<boolean> { return false; }
  
  async getVehicleTypePricingByCountry(country: string): Promise<VehicleTypePricing[]> { return []; }
  async createVehicleTypePricing(pricing: InsertVehicleTypePricing): Promise<VehicleTypePricing> { throw new Error("Not implemented"); }
  async updateVehicleTypePricing(id: number, updates: Partial<VehicleTypePricing>): Promise<VehicleTypePricing | undefined> { return undefined; }
  async deleteVehicleTypePricing(id: number): Promise<boolean> { return false; }

  async getFareByDistance(id: number): Promise<FareByDistance | undefined> { return undefined; }
  async getAllFaresByDistance(): Promise<FareByDistance[]> { return []; }
  async getAllRoutePricing(): Promise<RoutePricing[]> { return []; }
  async getAllVehicleTypePricing(): Promise<VehicleTypePricing[]> { return []; }
  async createFareByDistance(fare: InsertFareByDistance): Promise<FareByDistance> { throw new Error("Not implemented"); }
  async updateFareByDistance(id: number, updates: Partial<FareByDistance>): Promise<FareByDistance | undefined> { return undefined; }
  async deleteFareByDistance(id: number): Promise<boolean> { return false; }
  
  async getFareFlatRoute(id: number): Promise<FareFlatRoutes | undefined> { return undefined; }
  async getAllFareFlatRoutes(): Promise<FareFlatRoutes[]> { return []; }
  async createFareFlatRoute(fare: InsertFareFlatRoutes): Promise<FareFlatRoutes> { throw new Error("Not implemented"); }
  async updateFareFlatRoute(id: number, updates: Partial<FareFlatRoutes>): Promise<FareFlatRoutes | undefined> { return undefined; }
  async deleteFareFlatRoute(id: number): Promise<boolean> { return false; }
  
  async getFareHourly(id: number): Promise<FareHourly | undefined> { return undefined; }
  async getAllFareHourly(): Promise<FareHourly[]> { return []; }
  async createFareHourly(fare: InsertFareHourly): Promise<FareHourly> { throw new Error("Not implemented"); }
  async updateFareHourly(id: number, updates: Partial<FareHourly>): Promise<FareHourly | undefined> { return undefined; }
  async deleteFareHourly(id: number): Promise<boolean> { return false; }
  
  async getFareExtra(id: number): Promise<FareExtras | undefined> { return undefined; }
  async getAllFareExtras(): Promise<FareExtras[]> { return []; }
  async createFareExtra(fare: InsertFareExtras): Promise<FareExtras> { throw new Error("Not implemented"); }
  async updateFareExtra(id: number, updates: Partial<FareExtras>): Promise<FareExtras | undefined> { return undefined; }
  async deleteFareExtra(id: number): Promise<boolean> { return false; }
}

export const storage = new DatabaseStorage();

export async function updateDistanceFareWithEmit(id: string, data: any) {
  const updated = await updateDistanceFare(id, data)
  emitFareEvent('fare_distance_updated', updated)
  return updated
}

export async function updateHourlyFareWithEmit(id: string, data: any) {
  const updated = await updateHourlyFare(id, data)
  emitFareEvent('fare_hourly_updated', updated)
  return updated
}

export async function updateRouteFareWithEmit(id: string, data: any) {
  const updated = await updateRouteFare(id, data)
  emitFareEvent('fare_route_updated', updated)
  return updated
}

export async function updateExtraFareWithEmit(id: string, data: any) {
  const updated = await updateExtraFare(id, data)
  emitFareEvent('fare_extra_updated', updated)
  return updated
}