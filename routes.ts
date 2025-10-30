import type { Express } from "express";
import express from "express";
// ==== ViteCab PATCH: helpers (Avatar/KYC/Earnings/Billing) ====
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import PDFDocument from "pdfkit";
import {
  sendDocsReadyForReviewEmail,
  sendKycRequestReviewEmail,
  sendKycDecisionEmail,
  sendPayoutUpdatedEmail,
  sendInvoiceEmail,
} from "./email-service";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

function cldUploadBuffer(buffer: Buffer, opts: any = {}) {
  return new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
  { folder: "vitecab-driver-avatars", resource_type: "image", moderation: "webpurify", ...opts },
  (err, res) => (err ? reject(err) : resolve(res))
);
    stream.end(buffer);
  });
}
// ==== /PATCH helpers ====

import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { updateDistanceFareWithEmit, updateHourlyFareWithEmit, updateRouteFareWithEmit, updateExtraFareWithEmit } from "./storage";
import { 
  insertUserSchema, loginSchema, insertDriverSchema, insertRideSchema, insertSystemSettingsSchema, 
  insertPromoCodeSchema, insertRateSheetSchema, insertCommissionSettingsSchema, insertRoutePricingSchema, 
  insertVehicleTypePricingSchema, insertFareByDistanceSchema, insertFareFlatRoutesSchema, 
  insertFareHourlySchema, insertFareExtrasSchema 
} from "@shared/schema";
import { sendBookingConfirmation } from "./email-service";
import { ObjectStorageService, ObjectNotFoundError } from "./object-storage";
import { nanoid } from "nanoid";
import { createBooking } from "./booking-service";
import { calculateFare, getAvailableRoutes, getVehicleTypePricing } from "./fare-calculator";
import { upload, cloudinaryService } from "./upload";

const JWT_SECRET = process.env.SESSION_SECRET || "vitecab-local-development-secret-key-2024";


// Middleware for JWT authentication
function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Middleware for role-based authorization
function authorizeRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from attached_assets directory
  app.use('/attached_assets', express.static('attached_assets'));
  // Profile picture upload route (JWT-based auth) - Using Cloudinary
  app.post('/api/users/profile-picture', authenticateToken, upload.single('profileImage'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Upload to Cloudinary
      const result = await cloudinaryService.uploadFile(req.file.buffer, {
        folder: 'vitecab-profiles',
        public_id: `user_${req.user.id}_${Date.now()}`,
        resource_type: 'image',
        transformation: [
          { width: 400, height: 400, crop: 'fill' },
          { quality: 'auto:good' }
        ]
      });
      
// ====== ADMIN REALTIME PATCH (paste inside registerRoutes, near the bottom) ======
{
  // Realtime emit (runtime import — no top-level import needed)
  const { emit } = await import("./realtime");

  const publish = (topic: string, event: string, data: any) => {
    try {
      emit(topic, { event, data });
    } catch (e) {
      console.error("Realtime emit failed:", topic, event, e);
    }
  };

  // Minimal admin guard (use your existing authenticateToken)
  const requireAdmin = (req: any, res: any, next: any) => {
    if (req?.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }
    next();
  };

  // -----------------------------
  // RIDES (assign / unassign / cancel / complete / transfer)
  // -----------------------------
  app.post("/api/admin/rides/:id/assign",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const driverId = Number(req.body.driverId);
        if (Number.isNaN(driverId)) {
          return res.status(400).json({ message: "driverId must be a number" });
        }

        const updated = await storage.updateRide(id, {
          driverId,
          status: "assigned",
          startTime: new Date(),
        });

        if (!updated) return res.status(404).json({ message: "Ride not found" });

        publish("rides", "updated", updated);
        publish("drivers", "assigned", { rideId: id, driverId });
        return res.json(updated);
      } catch (e) {
        console.error("assign ride error:", e);
        return res.status(500).json({ message: "Failed to assign ride" });
      }
    }
  );

  app.post("/api/admin/rides/:id/unassign",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateRide(id, {
          driverId: null,
          status: "pending",
          startTime: null,
        });

        if (!updated) return res.status(404).json({ message: "Ride not found" });

        publish("rides", "updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("unassign ride error:", e);
        return res.status(500).json({ message: "Failed to unassign ride" });
      }
    }
  );

  app.post("/api/admin/rides/:id/cancel",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateRide(id, {
          status: "cancelled",
          endTime: new Date(),
        });

        if (!updated) return res.status(404).json({ message: "Ride not found" });

        publish("rides", "updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("cancel ride error:", e);
        return res.status(500).json({ message: "Failed to cancel ride" });
      }
    }
  );

  app.post("/api/admin/rides/:id/complete",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateRide(id, {
          status: "completed",
          endTime: new Date(),
        });

        if (!updated) return res.status(404).json({ message: "Ride not found" });

        publish("rides", "updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("complete ride error:", e);
        return res.status(500).json({ message: "Failed to complete ride" });
      }
    }
  );

  app.post("/api/admin/rides/:id/transfer",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const toDriverId = Number(req.body.toDriverId);
        if (Number.isNaN(toDriverId)) {
          return res.status(400).json({ message: "toDriverId must be a number" });
        }

        const updated = await storage.updateRide(id, {
          driverId: toDriverId,
          status: "assigned",
        });

        if (!updated) return res.status(404).json({ message: "Ride not found" });

        publish("rides", "updated", updated);
        publish("drivers", "transferred", { rideId: id, toDriverId });
        return res.json(updated);
      } catch (e) {
        console.error("transfer ride error:", e);
        return res.status(500).json({ message: "Failed to transfer ride" });
      }
    }
  );

  // -----------------------------
  // SETTINGS (system settings + promos)
  // -----------------------------
  app.put("/api/admin/settings",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const updated = await storage.updateSystemSettings(req.body);
        if (!updated) return res.status(404).json({ message: "Settings not found" });

        publish("settings", "updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update settings error:", e);
        return res.status(500).json({ message: "Failed to update settings" });
      }
    }
  );

  app.post("/api/admin/promos",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const created = await storage.createPromoCode(req.body);
        publish("promos", "created", created);
        return res.json(created);
      } catch (e) {
        console.error("create promo error:", e);
        return res.status(500).json({ message: "Failed to create promo" });
      }
    }
  );

  app.put("/api/admin/promos/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updatePromoCode(id, req.body);
        if (!updated) return res.status(404).json({ message: "Promo not found" });

        publish("promos", "updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update promo error:", e);
        return res.status(500).json({ message: "Failed to update promo" });
      }
    }
  );

  // Agar delete promo route chahiye aur storage me delete method nahi hai to skip kar dain.

  // -----------------------------
  // FARES / RATES (distance, hourly, route, extras, airport routePricing)
  // -----------------------------
  app.put("/api/admin/fares/distance/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateFareByDistance(id, req.body);
        if (!updated) return res.status(404).json({ message: "Fare (distance) not found" });

        publish("rates", "fare_distance_updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update distance fare error:", e);
        return res.status(500).json({ message: "Failed to update distance fare" });
      }
    }
  );

  app.put("/api/admin/fares/hourly/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateFareHourly(id, req.body);
        if (!updated) return res.status(404).json({ message: "Fare (hourly) not found" });

        publish("rates", "fare_hourly_updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update hourly fare error:", e);
        return res.status(500).json({ message: "Failed to update hourly fare" });
      }
    }
  );

  app.put("/api/admin/fares/route/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateFareFlatRoute(id, req.body);
        if (!updated) return res.status(404).json({ message: "Fare (route) not found" });

        publish("rates", "fare_route_updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update route fare error:", e);
        return res.status(500).json({ message: "Failed to update route fare" });
      }
    }
  );

  app.put("/api/admin/fares/extra/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateFareExtra(id, req.body);
        if (!updated) return res.status(404).json({ message: "Fare (extra) not found" });

        publish("rates", "fare_extra_updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update extra fare error:", e);
        return res.status(500).json({ message: "Failed to update extra fare" });
      }
    }
  );

  // Airport routes -> routePricing table
  app.put("/api/admin/airport-rates/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateRoutePricing(id, req.body);
        if (!updated) return res.status(404).json({ message: "Airport rate not found" });

        publish("rates", "airport_rate_updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update airport rate error:", e);
        return res.status(500).json({ message: "Failed to update airport rate" });
      }
    }
  );

  // -----------------------------
  // DRIVERS / KYC
  // -----------------------------
  app.post("/api/admin/drivers/:id/kyc",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const { status = "pending", ...updates } = req.body || {};
        const updatedDriver = await storage.updateDriverKYCStatus(id, status, updates);
        if (!updatedDriver) return res.status(404).json({ message: "Driver not found" });

        publish("kyc", "updated", updatedDriver);
        publish("drivers", "updated", updatedDriver);
        return res.json(updatedDriver);
      } catch (e) {
        console.error("update KYC error:", e);
        return res.status(500).json({ message: "Failed to update KYC" });
      }
    }
  );

  // (Optional) generic driver update
  app.put("/api/admin/drivers/:id",
    authenticateToken,
    requireAdmin,
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);
        const updated = await storage.updateDriver(id, req.body);
        if (!updated) return res.status(404).json({ message: "Driver not found" });

        publish("drivers", "updated", updated);
        return res.json(updated);
      } catch (e) {
        console.error("update driver error:", e);
        return res.status(500).json({ message: "Failed to update driver" });
      }
    }
  );

  // -----------------------------
  // (Optional stubs for surge/partners if needed later)
  // -----------------------------
  // NOTE: Surge aur partners kay exact storage methods aapke code me defined nahi the,
  // is liye inko abhi skip rakha hai. Jab aap persistence methods bana den, yahin par
  // publish("surge" | "partners", "updated" | "created" | "deleted", data) call kar dena.
}
// ====== ADMIN REALTIME PATCH END ======

      // Update user profile in database
      await storage.updateUser(req.user.id, {
        profileImage: result.secure_url
      });
      
      res.json({ 
        message: 'Profile picture uploaded successfully',
        profileImageUrl: result.secure_url,
        imageUrl: result.secure_url
      });
    } catch (error) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({ error: 'Failed to upload profile picture' });
    }
  });

  // Driver document upload routes - Using Cloudinary
  app.post('/api/drivers/documents/upload', authenticateToken, authorizeRole(['driver']), upload.fields([
    { name: 'license', maxCount: 1 },
    { name: 'registration', maxCount: 1 },
    { name: 'insurance', maxCount: 1 },
    { name: 'vehiclePhoto', maxCount: 1 },
    { name: 'driverPhoto', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ error: 'Driver profile not found' });
      }

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const uploadedDocuments: any = {};

      // Upload each document to Cloudinary
      for (const [fieldName, fileArray] of Object.entries(files)) {
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const documentType = fieldName as 'license' | 'registration' | 'insurance' | 'vehiclePhoto' | 'driverPhoto';
          
          try {
            const result = await cloudinaryService.uploadDriverDocument(
              file.buffer,
              documentType,
              driver.id.toString()
            );
            
            uploadedDocuments[`${fieldName}DocumentUrl`] = result.secure_url;
          } catch (uploadError) {
            console.error(`Failed to upload ${fieldName}:`, uploadError);
            return res.status(500).json({ error: `Failed to upload ${fieldName}` });
          }
        }
      }

      // Update driver with new document URLs
      if (Object.keys(uploadedDocuments).length > 0) {
        await storage.updateDriver(driver.id, uploadedDocuments);
      }

      res.json({ 
        message: 'Documents uploaded successfully',
        documents: uploadedDocuments
      });
    } catch (error) {
      console.error('Driver document upload error:', error);
      res.status(500).json({ error: 'Failed to upload documents' });
    }
  });
  // Clear auth route for development
  app.get("/clear-auth", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Clearing Authentication</title></head>
      <body>
        <h1>Clearing Authentication...</h1>
        <script>
          localStorage.clear();
          setTimeout(() => window.location.href = '/', 1000);
        </script>
      </body>
      </html>
    `);
  });

// ==== ViteCab PATCH: Driver avatar upload ====
app.post(
  "/api/drivers/me/avatar",
  authenticateToken,
  authorizeRole(["driver"]),
  upload.single("avatar"),                  // field name MUST be "avatar"
  async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file" });

      const me = await storage.getDriverByUserId(req.user.id);
      if (!me) return res.status(404).json({ message: "Driver not found" });

      // Cloudinary upload with moderation
      const out = await cldUploadBuffer(req.file.buffer, {
        folder: "vitecab-driver-avatars",
        moderation: "aws_rek"
      });

      // moderation reject?
      const status = (out as any)?.moderation?.[0]?.status;
      if (status && status !== "approved") {
        try { await cloudinary.uploader.destroy((out as any).public_id, { resource_type: "image" }); } catch (e) {}
        return res.status(400).json({ message: "Avatar rejected by moderation" });
      }

      const url = out.secure_url;
      await storage.updateDriver(me.id, { avatarUrl: url });
      await storage.updateUser(me.userId, { profileImage: url });

      return res.json({ avatarUrl: url });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Avatar upload failed" });
    }
  }
);
// ==== /PATCH ====

// ==== ViteCab PATCH: Driver delete self ====
app.delete("/api/drivers/me",
  authenticateToken,
  authorizeRole(["driver"]),
  async (req: any, res) => {
    try {
      const me = await storage.getDriverByUserId(req.user.id);
      if (!me) return res.status(404).json({ message: "Driver not found" });
      await storage.deleteDriver(me.id);
      await storage.deleteUser(me.userId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "Delete failed" });
    }
  }
);
// ==== /PATCH delete ====


// ==== ViteCab PATCH: Earnings for UI ====
app.get("/api/drivers/me/earnings",
  authenticateToken,
  authorizeRole(["driver"]),
  async (req: any, res) => {
    try {
      const me = await storage.getDriverByUserId(req.user.id);
      if (!me) return res.status(404).json({ message: "Driver not found" });

      const { from, to } = req.query as { from?: string; to?: string };
      const rides = await storage.getRidesByDriver(me.id);

      const fromD = from ? new Date(from) : undefined;
      const toD   = to   ? new Date(to)   : undefined;

      const filtered = rides.filter((r: any) => {
        const t = new Date(r.endTime ?? r.requestTime ?? Date.now()).getTime();
        if (fromD && t < fromD.getTime()) return false;
        if (toD && t > toD.getTime()) return false;
        return ["completed","paid","settled"].includes(r.status);
      });

      const rows = filtered.map((r: any) => ({
        id: r.id,
        createdAt: r.requestTime,
        fareTotal: Number(r.fare ?? r.baseFare ?? 0),
        platformCommissionRate: 0.15,
        platformFeeRate: 0.02,
      }));
      res.json(rows);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: "Failed to load earnings" });
    }
  }
);
// ==== /PATCH earnings ====


// ==== ViteCab PATCH: Billing statement (csv|txt|pdf) ====
app.get("/api/drivers/:id/billing-statement",
  authenticateToken,
  async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const fmt = (req.query.format as string || "csv").toLowerCase();
      const { from, to } = req.query as { from?: string; to?: string };

      const me = await storage.getDriverByUserId(req.user.id);
      const isAdmin = req.user?.role === "admin";
      if (!isAdmin && (!me || me.id !== id)) return res.status(403).json({ message: "Forbidden" });

      const rides = await storage.getRidesByDriver(id);
      const fromD = from ? new Date(from) : undefined;
      const toD   = to   ? new Date(to)   : undefined;

      const rows = rides
        .filter((r: any) => {
          const t = new Date(r.endTime ?? r.requestTime ?? Date.now()).getTime();
          if (fromD && t < fromD.getTime()) return false;
          if (toD && t > toD.getTime()) return false;
          return ["completed","paid","settled"].includes(r.status);
        })
        .map((r: any) => {
          const gross = Number(r.fare ?? r.baseFare ?? 0);
          const commission = +(gross * 0.15).toFixed(2);
          const platformFee = +(gross * 0.02).toFixed(2);
          const taxableBase = Math.max(0, gross - commission - platformFee);
          const vatRate = 0.20; // default; UI can use country map too
          const tax = +(taxableBase * vatRate).toFixed(2);
          const net = +(gross - commission - platformFee - tax).toFixed(2);
          return { id: r.id, date: new Date(r.requestTime).toISOString().slice(0,10), gross, commission, platformFee, tax, net };
        });

      if (fmt === "csv" || fmt === "txt") {
        const header = "Ride ID,Date,Gross,Commission,Platform Fee,Tax,Net\n";
        const body = rows.map(r => `${r.id},${r.date},${r.gross},${r.commission},${r.platformFee},${r.tax},${r.net}`).join("\n");
        const mime = fmt === "csv" ? "text/csv" : "text/plain";
        res.setHeader("Content-Type", `${mime}; charset=utf-8`);
        res.setHeader("Content-Disposition", `attachment; filename="billing_${id}.${fmt}"`);
        res.send(header + body);
        await sendInvoiceEmail(me.userId, fmt);
        return;
      }

      // PDF
      const doc = new PDFDocument({ margin: 36 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="billing_${id}.pdf"`);
      doc.pipe(res);
      doc.fontSize(16).text("Billing Statement", { underline: true });
      doc.moveDown();
      rows.forEach(r => doc.fontSize(11).text(`${r.date} • Ride #${r.id} • Gross ${r.gross} • Comm ${r.commission} • Fee ${r.platformFee} • Tax ${r.tax} • Net ${r.net}`));
      doc.end();
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ message: "Failed to generate statement" });
    }
  }
);
// ==== /PATCH billing ====


// ==== ViteCab PATCH: KYC (driver) ====
app.post("/api/kyc/request-review",
  authenticateToken,
  authorizeRole(["driver"]),
  async (req: any, res) => {
    try {
      const me = await storage.getDriverByUserId(req.user.id);
      if (!me) return res.status(404).json({ message: "Driver not found" });
      const { notes } = req.body || {};
      const updated = await storage.updateDriver(me.id, { manualKycStatus: "pending", manualKycNotes: notes || "" });
      await sendKycRequestReviewEmail(updated);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to request review" });
    }
  }
);

app.get("/api/kyc/status",
  authenticateToken,
  authorizeRole(["driver"]),
  async (req: any, res) => {
    try {
      const me = await storage.getDriverByUserId(req.user.id);
      if (!me) return res.status(404).json({ message: "Driver not found" });
      res.json({
        verificationStatus: me.kycStatus || "pending",
        identityVerified: !!me.identityVerified,
        addressVerified: !!me.addressVerified,
        vehicleVerified: !!me.vehicleVerified,
        backgroundCheckVerified: !!me.backgroundCheckVerified,
        kycNotes: me.manualKycNotes || me.verificationNotes || null,
      });
    } catch (e: any) {
      res.status(500).json({ message: "Failed to load KYC status" });
    }
  }
);
// ==== /PATCH kyc ====


// ==== ViteCab PATCH: Driver payout ====
app.put("/api/drivers/:id/payout",
  authenticateToken,
  authorizeRole(["driver","admin"]),
  async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const me = await storage.getDriverByUserId(req.user.id);
      const isAdmin = req.user?.role === "admin";
      if (!isAdmin && (!me || me.id !== id)) return res.status(403).json({ message: "Forbidden" });

      const {
        paymentMethod, iban, bic, paypalEmail, stripeAccountId,
        accountHolderName, bankName, accountNumber
      } = req.body || {};

      const updated = await storage.updateDriver(id, {
        paymentMethod, iban, bic, paypalEmail, stripeAccountId,
        accountHolderName, bankName, accountNumber,
        bankingVerified: paymentMethod === "bank_transfer" ? true : false,
      });
      await sendPayoutUpdatedEmail(updated);
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: "Failed to update payout" });
    }
  }
);
// ==== /PATCH payout ====


// ==== ViteCab PATCH: post-update hook for existing PUT /api/drivers/:id ====
// NOTE: Find your existing handler for PUT /api/drivers/:id.
// Inside it, **just after** you call `const updatedDriver = await storage.updateDriver(id, updates)`,
// insert the following block:

/*
try {
  const d = await storage.getDriver(id);
  const docsComplete = !!(
    d?.licenseDocumentUrl &&
    d?.vehicleRegistrationUrl &&
    d?.insuranceDocumentUrl &&
    d?.vehiclePhotoUrl &&
    d?.driverSelfieUrl
  );

  const touched = [
    "vehicleModel","vehicleColor","plateNumber","licenseNumber",
    "licenseDocumentUrl","vehicleRegistrationUrl","insuranceDocumentUrl","vehiclePhotoUrl","driverSelfieUrl"
  ].some(k => k in updates);

  if (touched && d?.kycStatus !== "pending") {
    await storage.updateDriver(id, { kycStatus: "pending" });
  }
  if (docsComplete && !d?.documentsUploaded) {
    await storage.updateDriver(id, { documentsUploaded: true });
    await sendDocsReadyForReviewEmail(d!);
  }
} catch {}
*/
// ==== /PATCH post-update hook ====


  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Create user (password hashing and token generation handled in storage)
      const user = await storage.createUser(userData);

      // Generate token
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send verification email
      if (user.emailVerificationToken) {
        await EmailService.sendVerificationEmail(user, user.emailVerificationToken);
      }

      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      res.status(201).json({ 
        user: userWithoutPassword, 
        token, 
        message: 'Account created successfully! Please check your email to verify your account.' 
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid user data", error });
    }
  });

  // Login route
app.post("/api/auth/login", async (req, res) => {
  try {
    const loginData = loginSchema.parse(req.body);

    // Find user by email
    const user = await storage.getUserByEmail(loginData.email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Block login if email not verified
    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
    }

    // ✅ Compare password with bcrypt
    const isPasswordValid = await bcrypt.compare(loginData.password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
  { id: user.id, role: user.role },
  JWT_SECRET,
  { expiresIn: "7d" }
);

    // Remove password before sending user object
    const { password, ...userWithoutPassword } = user;

    return res.json({ user: userWithoutPassword, token });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ message: error.message || "Login failed" });
  }
});

  // Email verification route
  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      // Find user by verification token
      const user = await storage.getUserByEmailVerificationToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      if (user.emailVerified) {
        return res.status(200).json({ message: "Email already verified" });
      }

      // Update user as verified
      await storage.updateUserEmailVerification(user.id, true);
      
      // Send welcome email after verification
      await EmailService.sendWelcomeEmail(user);

      // Return HTML success page instead of redirect
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Verified - ViteCab</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .container { max-width: 600px; margin: 0 auto; }
              .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
              .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">✓ Email Verified Successfully!</div>
              <p>Your ViteCab account has been verified. You can now login to your account.</p>
              <a href="/" class="button">Go to ViteCab</a>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Manual verification route for development
  app.post("/api/auth/verify-email-manual", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(200).json({ message: "Email already verified" });
      }

      // Update user as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null
      });

      res.json({ message: "Email verified successfully! You can now use your account." });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Password reset request route
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists for security
        return res.json({ message: "If an account with this email exists, a password reset link has been sent." });
      }

      // Generate reset token and send email
      const resetToken = nanoid(32);
      await storage.setPasswordResetToken(user.id, resetToken);
      await EmailService.sendPasswordResetEmail(user, resetToken);

      res.json({ message: "If an account with this email exists, a password reset link has been sent." });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Password reset form page
  app.get("/api/auth/reset-password", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invalid Reset Link - ViteCab</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .container { max-width: 600px; margin: 0 auto; }
                .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
                .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error">❌ Invalid Reset Link</div>
                <p>This password reset link is invalid or expired.</p>
                <a href="/" class="button">Go to ViteCab</a>
              </div>
            </body>
          </html>
        `);
      }

      // Verify token exists
      const user = await storage.getUserByPasswordResetToken(token);
      
      if (!user) {
        return res.status(400).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Expired Reset Link - ViteCab</title>
              <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                .container { max-width: 600px; margin: 0 auto; }
                .error { color: #dc3545; font-size: 24px; margin-bottom: 20px; }
                .button { background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="error">❌ Reset Link Expired</div>
                <p>This password reset link has expired. Please request a new one.</p>
                <a href="/" class="button">Go to ViteCab</a>
              </div>
            </body>
          </html>
        `);
      }

      // Show password reset form
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reset Password - ViteCab</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 50px; background: #f5f5f5; }
              .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .title { color: #333; font-size: 24px; margin-bottom: 20px; text-align: center; }
              .form-group { margin-bottom: 20px; }
              .form-group label { display: block; margin-bottom: 5px; font-weight: bold; }
              .form-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }
              .button { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; width: 100%; font-size: 16px; }
              .button:hover { background: #0056b3; }
              .message { margin-top: 15px; padding: 10px; border-radius: 5px; text-align: center; }
              .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
              .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="title">Reset Your Password</div>
              <form id="resetForm">
                <div class="form-group">
                  <label for="newPassword">New Password:</label>
                  <input type="password" id="newPassword" name="newPassword" required minlength="6" />
                </div>
                <div class="form-group">
                  <label for="confirmPassword">Confirm Password:</label>
                  <input type="password" id="confirmPassword" name="confirmPassword" required minlength="6" />
                </div>
                <button type="submit" class="button">Reset Password</button>
              </form>
              <div id="message"></div>
            </div>
            
            <script>
              document.getElementById('resetForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const newPassword = document.getElementById('newPassword').value;
                const confirmPassword = document.getElementById('confirmPassword').value;
                const messageEl = document.getElementById('message');
                
                if (newPassword !== confirmPassword) {
                  messageEl.innerHTML = '<div class="message error">Passwords do not match</div>';
                  return;
                }
                
                if (newPassword.length < 6) {
                  messageEl.innerHTML = '<div class="message error">Password must be at least 6 characters</div>';
                  return;
                }
                
                try {
                  const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                      token: '${token}',
                      newPassword: newPassword 
                    })
                  });
                  
                  const data = await response.json();
                  
                  if (response.ok) {
                    messageEl.innerHTML = '<div class="message success">' + data.message + '</div>';
                    setTimeout(() => {
                      window.location.href = '/';
                    }, 2000);
                  } else {
                    messageEl.innerHTML = '<div class="message error">' + data.message + '</div>';
                  }
                } catch (error) {
                  messageEl.innerHTML = '<div class="message error">Network error occurred</div>';
                }
              });
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send('<h1>Server Error</h1><p>Please try again later.</p>');
    }
  });

  // Password reset route
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Find user by reset token
      const user = await storage.getUserByPasswordResetToken(token);
      
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Update password
      await storage.updateUserPassword(user.id, newPassword);

      res.json({ message: "Password reset successfully! You can now login with your new password." });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Manual KYC request route
  app.post("/api/drivers/manual-kyc-request", authenticateToken, async (req: any, res) => {
    try {
      const { driverId } = req.body;
      
      const driver = await storage.getDriver(driverId);
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      // Update driver with manual KYC request
      await storage.updateDriver(driverId, {
        manualKycStatus: "pending",
        manualKycNotes: "Manual review requested by driver"
      });

      res.json({ message: "Manual KYC review requested successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Payment processing route
  app.post("/api/payments/process", authenticateToken, async (req: any, res) => {
    try {
      const { rideId, paymentMethod, amount, cardDetails, paypalEmail } = req.body;
      
      const ride = await storage.getRide(rideId);
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      // Simulate payment processing
      let paymentResult: any = {
        success: true,
        transactionId: `txn_${Date.now()}`,
        amount: amount,
        method: paymentMethod,
      };

      if (paymentMethod === "card") {
        // In real app, integrate with Stripe or other payment processor
        paymentResult.cardLast4 = cardDetails?.cardNumber?.slice(-4) || "0000";
      } else if (paymentMethod === "paypal") {
        paymentResult.paypalEmail = paypalEmail;
      }

      // Update ride with payment information
      await storage.updateRide(rideId, {
        paymentMethodType: paymentMethod,
        paymentStatus: "completed",
        paymentMethodDetails: paymentResult,
      });

      res.json({
        message: "Payment processed successfully",
        paymentResult,
      });
    } catch (error) {
      res.status(500).json({ message: "Payment processing failed", error });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Change password route
  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get current user
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password in database
      await storage.updateUserPassword(user.id, hashedPassword);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: "Server error", error });
    }
  });

  // Delete account route
  app.delete("/api/users/account", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Get user to check if exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user account and all associated data
      await storage.deleteUser(userId);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ message: "Server error", error });
    }
  });

  // User routes
  app.get("/api/users", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users", error });
    }
  });

  app.put("/api/users/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only update their own profile, admins can update any
      if (req.user.role !== 'admin' && req.user.id !== id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updatedUser = await storage.updateUser(id, req.body);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user", error });
    }
  });

  // Change password endpoint
  app.post("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters long" });
      }

      // Get current user
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUserPassword(user.id, hashedNewPassword);

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: "Failed to change password", error });
    }
  });

  // Delete account endpoint
  app.delete("/api/users/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Users can only delete their own account, admins can delete any
      if (req.user.role !== 'admin' && req.user.id !== id) {
        return res.status(403).json({ message: "Not authorized to delete this account" });
      }

      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Delete user account
      await storage.deleteUser(id);

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ message: "Failed to delete account", error });
    }
  });

  // Driver routes
  app.post("/api/drivers", authenticateToken, async (req: any, res) => {
    try {
      const driverData = insertDriverSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      // Check if driver profile already exists
      const existingDriver = await storage.getDriverByUserId(req.user.id);
      if (existingDriver) {
        return res.status(400).json({ message: "Driver profile already exists" });
      }

      const driver = await storage.createDriver(driverData);
      res.status(201).json(driver);
    } catch (error) {
      console.error("Driver creation error:", error);
      res.status(400).json({ message: "Invalid driver data", error: error.issues || error.message });
    }
  });

  app.get("/api/drivers", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drivers", error });
    }
  });

  // Get drivers for KYC management (admin only)
  app.get("/api/admin/drivers/kyc", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const drivers = await storage.getAllDriversWithUsers();
      res.json(drivers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch drivers", error });
    }
  });

  // Approve driver KYC (admin only)
  app.post("/api/admin/drivers/:id/approve", authenticateToken, authorizeRole(['admin']), async (req: any, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const { notes } = req.body;
      
      const driver = await storage.updateDriverKYCStatus(driverId, "approved", {
        verificationNotes: notes,
        reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(),
        isVerified: true,
        isActive: true
      });
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      res.json({ message: "Driver approved successfully", driver });
    } catch (error) {
      res.status(500).json({ message: "Failed to approve driver", error });
    }
  });

  // Reject driver KYC (admin only)
  app.post("/api/admin/drivers/:id/reject", authenticateToken, authorizeRole(['admin']), async (req: any, res) => {
    try {
      const driverId = parseInt(req.params.id);
      const { reason, notes } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }
      
      const driver = await storage.updateDriverKYCStatus(driverId, "rejected", {
        rejectionReason: reason,
        verificationNotes: notes,
        reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(),
        isVerified: false,
        isActive: false
      });
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      
      res.json({ message: "Driver rejected successfully", driver });
    } catch (error) {
      res.status(500).json({ message: "Failed to reject driver", error });
    }
  });

  app.get("/api/drivers/me", authenticateToken, authorizeRole(['driver']), async (req: any, res) => {
    try {
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }
      res.json(driver);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch driver profile", error });
    }
  });

  app.put("/api/drivers/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedDriver = await storage.updateDriver(id, req.body);
      
      if (!updatedDriver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json(updatedDriver);
    } catch (error) {
      res.status(500).json({ message: "Failed to update driver", error });
    }
  });

  // KYC Verification endpoints
  app.post("/api/drivers/:id/kyc/verify", authenticateToken, authorizeRole(['admin']), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, faceMatchScore, documentVerificationScore, notes } = req.body;
      
      const updatedDriver = await storage.updateDriver(id, {
        kycStatus: status,
        faceMatchScore: faceMatchScore?.toString(),
        documentVerificationScore: documentVerificationScore?.toString(),
        verificationDate: status === "verified" ? new Date() : null,
        verificationNotes: notes,
      });
      
      if (!updatedDriver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json(updatedDriver);
    } catch (error) {
      res.status(400).json({ message: "Failed to update KYC status", error });
    }
  });

  app.post("/api/drivers/:id/documents/upload", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { documentType, documentUrl } = req.body;
      
      const updateData: any = {};
      
      // Map document types to database fields
      switch (documentType) {
        case "license":
          updateData.licenseDocumentUrl = documentUrl;
          break;
        case "registration":
          updateData.vehicleRegistrationUrl = documentUrl;
          break;
        case "insurance":
          updateData.insuranceDocumentUrl = documentUrl;
          break;
        case "vehicle_photo":
          updateData.vehiclePhotoUrl = documentUrl;
          break;
        case "selfie":
          updateData.driverSelfieUrl = documentUrl;
          break;
        case "background_check":
          updateData.backgroundCheckUrl = documentUrl;
          break;
        default:
          return res.status(400).json({ message: "Invalid document type" });
      }
      
      const updatedDriver = await storage.updateDriver(id, updateData);
      
      if (!updatedDriver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      res.json(updatedDriver);
    } catch (error) {
      res.status(400).json({ message: "Failed to upload document", error });
    }
  });

  app.post("/api/drivers/:id/kyc/auto-verify", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      // Simulate automated KYC verification
      const hasAllDocuments = driver.licenseDocumentUrl && 
                            driver.vehicleRegistrationUrl && 
                            driver.insuranceDocumentUrl && 
                            driver.vehiclePhotoUrl && 
                            driver.driverSelfieUrl;

      if (!hasAllDocuments) {
        return res.status(400).json({ message: "All required documents must be uploaded first" });
      }

      // Simulate AI verification scores
      const faceMatchScore = Math.random() * 20 + 80; // 80-100%
      const documentVerificationScore = Math.random() * 15 + 85; // 85-100%
      
      const verificationResult = faceMatchScore > 75 && documentVerificationScore > 80 ? "verified" : "rejected";
      
      const updatedDriver = await storage.updateDriver(id, {
        kycStatus: verificationResult,
        faceMatchScore: faceMatchScore.toFixed(1),
        documentVerificationScore: documentVerificationScore.toFixed(1),
        verificationDate: verificationResult === "verified" ? new Date() : null,
        verificationNotes: verificationResult === "verified" 
          ? "Automated verification successful. All documents verified and face match confirmed."
          : "Automated verification failed. Please review documents and resubmit.",
      });

      res.json(updatedDriver);
    } catch (error) {
      res.status(500).json({ message: "Auto-verification failed", error });
    }
  });



  // Get available routes for booking
  app.get("/api/bookings/routes", authenticateToken, async (req: any, res) => {
    try {
      const vehicleType = req.query.vehicleType as string;
      const routes = await getAvailableRoutes(vehicleType);
      res.json(routes);
    } catch (error: any) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ 
        error: "Failed to fetch routes",
        message: error.message 
      });
    }
  });

  // Get vehicle pricing for booking form
  app.get("/api/bookings/pricing", async (req: any, res) => {
    try {
      const pricing = await getVehicleTypePricing();
      res.json(pricing);
    } catch (error: any) {
      console.error("Error fetching pricing:", error);
      res.status(500).json({ 
        error: "Failed to fetch pricing",
        message: error.message 
      });
    }
  });

  // Calculate fare estimate before booking
  app.post("/api/bookings/estimate", async (req: any, res) => {
    try {
      const fareCalculation = await calculateFare({
        vehicleType: req.body.vehicleType,
        pickupLat: req.body.pickupLat,
        pickupLng: req.body.pickupLng,
        dropoffLat: req.body.dropoffLat,
        dropoffLng: req.body.dropoffLng,
        routeId: req.body.routeId,
        isHourly: req.body.isHourly,
        estimatedHours: req.body.estimatedHours,
        extras: req.body.extras
      });

      res.json(fareCalculation);
    } catch (error: any) {
      console.error("Fare estimation error:", error);
      res.status(500).json({ 
        error: "Failed to calculate fare",
        message: error.message 
      });
    }
  });



  // Ride routes
  app.post("/api/rides", authenticateToken, authorizeRole(['customer']), async (req: any, res) => {
    try {
      const rideData = insertRideSchema.parse({
        ...req.body,
        customerId: req.user.id
      });
      
      const ride = await storage.createRide(rideData);
      res.status(201).json(ride);
    } catch (error) {
      res.status(400).json({ message: "Invalid ride data", error });
    }
  });

  app.get("/api/rides", authenticateToken, async (req: any, res) => {
    try {
      let rides;
      
      if (req.user.role === 'admin') {
        rides = await storage.getAllRides();
      } else if (req.user.role === 'customer') {
        rides = await storage.getRidesByCustomer(req.user.id);
      } else if (req.user.role === 'driver') {
        const driver = await storage.getDriverByUserId(req.user.id);
        if (!driver) {
          return res.status(404).json({ message: "Driver profile not found" });
        }
        rides = await storage.getRidesByDriver(driver.id);
      }
      
      res.json(rides);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rides", error });
    }
  });

  app.get("/api/rides/pending", authenticateToken, authorizeRole(['driver']), async (req: any, res) => {
    try {
      // Get the driver's profile to filter rides by their country, city, and car class
      const driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        return res.status(404).json({ message: "Driver profile not found" });
      }

      // Only get rides that match the driver's location and vehicle capability
      const filteredRides = await storage.getPendingRidesForDriver(
        driver.country || "France",
        driver.city || "Paris", 
        driver.carClass || "Berline Economy"
      );
      
      res.json(filteredRides);
    } catch (error) {
      console.error("Error fetching pending rides for driver:", error);
      res.status(500).json({ message: "Failed to fetch pending rides", error });
    }
  });

  app.put("/api/rides/:id", authenticateToken, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const ride = await storage.getRide(id);
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }

      // Check authorization
      if (req.user.role === 'customer' && ride.customerId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      if (req.user.role === 'driver') {
        const driver = await storage.getDriverByUserId(req.user.id);
        if (!driver || ride.driverId !== driver.id) {
          return res.status(403).json({ message: "Not authorized" });
        }
      }

      const updatedRide = await storage.updateRide(id, req.body);
      res.json(updatedRide);
    } catch (error) {
      res.status(500).json({ message: "Failed to update ride", error });
    }
  });
  
// 🚕 Admin ride actions
app.post("/api/admin/rides/:id/assign", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { driverId } = req.body;
    const numericDriverId = parseInt(driverId);

    if (isNaN(id) || isNaN(numericDriverId)) {
      return res.status(400).json({ message: "Invalid ride or driver ID" });
    }

    const updated = await storage.updateRide(id, {
      driverId: numericDriverId,
      status: 'assigned',
      startTime: new Date(),
    });

    if (!updated) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (io) io.emit("ride_assigned", { rideId: id, driverId: numericDriverId });
    return res.json({ success: true, message: "Driver assigned successfully", ride: updated });
  } catch (error) {
    console.error("Assign error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

app.post("/api/admin/rides/:id/unassign", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ride ID" });
    }

    const updated = await storage.updateRide(id, {
      driverId: null,
      status: 'pending',
      startTime: null,
    });

    if (!updated) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (io) io.emit("ride_unassigned", { rideId: id });
    return res.json({ success: true, message: "Driver unassigned successfully", ride: updated });
  } catch (error) {
    console.error("Unassign error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

app.post("/api/admin/rides/:id/cancel", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ride ID" });

    const updated = await storage.updateRide(id, {
      status: "cancelled",
      endTime: new Date(),
    });

    if (!updated) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (io) io.emit("ride_cancelled", { rideId: id });
    return res.json({ success: true, message: "Ride cancelled successfully", ride: updated });
  } catch (error) {
    console.error("Cancel error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

app.post("/api/admin/rides/:id/complete", authenticateToken, authorizeRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ride ID" });

    const updated = await storage.updateRide(id, {
      status: "completed",
      endTime: new Date(),
    });

    if (!updated) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (io) io.emit("ride_completed", { rideId: id });
    return res.json({ success: true, message: "Ride completed successfully", ride: updated });
  } catch (error) {
    console.error("Complete error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

  // Fare estimation
  app.post("/api/fare/estimate", authenticateToken, async (req, res) => {
    try {
      const { distance, vehicleType } = req.body;
      const settings = await storage.getSystemSettings();
      
      if (!settings) {
        return res.status(500).json({ message: "System settings not found" });
      }

      let baseFare = parseFloat(settings.baseFarePerKm) * distance;
      
      if (vehicleType === 'premium') {
        baseFare *= parseFloat(settings.premiumMultiplier);
      }

      const tax = baseFare * (parseFloat(settings.serviceTax) / 100);
      const totalFare = baseFare + tax;

      res.json({
        baseFare: baseFare.toFixed(2),
        tax: tax.toFixed(2),
        totalFare: totalFare.toFixed(2),
        distance
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate fare", error });
    }
  });

  // System settings routes
  // Public basic settings for booking form pricing
  app.get("/api/settings/public", async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      // Only return pricing-related settings, not sensitive admin data
      const publicSettings = {
        baseFarePerKm: settings?.baseFarePerKm || "2.5",
        commissionRate: settings?.commissionRate || "15",
        serviceTax: settings?.serviceTax || "8.5"
      };
      res.json(publicSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch public settings", error });
    }
  });

  app.get("/api/settings", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const settings = await storage.getSystemSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings", error });
    }
  });

  app.put("/api/settings", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const settingsData = insertSystemSettingsSchema.parse(req.body);
      const updatedSettings = await storage.updateSystemSettings(settingsData);
      res.json(updatedSettings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data", error });
    }
  });

  // Promo code routes
  app.get("/api/promo-codes", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const promoCodes = await storage.getAllPromoCodes();
      res.json(promoCodes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch promo codes", error });
    }
  });

  app.post("/api/promo-codes", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const promoCodeData = insertPromoCodeSchema.parse(req.body);
      const promoCode = await storage.createPromoCode(promoCodeData);
      res.status(201).json(promoCode);
    } catch (error) {
      res.status(400).json({ message: "Invalid promo code data", error });
    }
  });

  app.get("/api/promo-codes/:code", authenticateToken, async (req, res) => {
    try {
      const promoCode = await storage.getPromoCode(req.params.code);
      if (!promoCode) {
        return res.status(404).json({ message: "Promo code not found" });
      }
      res.json(promoCode);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch promo code", error });
    }
  });

  // Dashboard analytics
  app.get("/api/analytics", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const drivers = await storage.getAllDrivers();
      const rides = await storage.getAllRides();
      
      const totalUsers = users.filter(u => u.role === 'customer').length;
      const activeDrivers = drivers.filter(d => d.isOnline).length;
      const totalRides = rides.length;
      const completedRides = rides.filter(r => r.status === 'completed');
      const totalRevenue = completedRides.reduce((sum, ride) => sum + parseFloat(ride.fare), 0);

      res.json({
        totalUsers,
        totalDrivers: drivers.length,
        activeDrivers,
        totalRides,
        completedRides: completedRides.length,
        totalRevenue: totalRevenue.toFixed(2)
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics", error });
    }
  });

  // Rate Management API Routes
  
  // Get rates by country
  app.get("/api/rates/:country", async (req, res) => {
    try {
      const { country } = req.params;
      const rateSheet = await storage.getRateSheetByCountry(country);
      if (!rateSheet) {
        return res.status(404).json({ message: "Rate sheet not found for this country" });
      }
      res.json(rateSheet);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rate sheet", error });
    }
  });

  // Get route pricing by country
  app.get("/api/route-pricing/:country", async (req, res) => {
    try {
      const { country } = req.params;
      const routePricing = await storage.getRoutePricingByCountry(country);
      res.json(routePricing);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch route pricing", error });
    }
  });

  // Get vehicle types
  app.get("/api/vehicle-types", async (req, res) => {
    try {
      const vehicleTypes = await storage.getAllVehicleTypePricing();
      res.json(vehicleTypes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vehicle types", error });
    }
  });

  // Get commission settings by country
  app.get("/api/commission/:country", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const { country } = req.params;
      const commissionSettings = await storage.getCommissionSettingsByCountry(country);
      if (!commissionSettings) {
        return res.status(404).json({ message: "Commission settings not found for this country" });
      }
      res.json(commissionSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch commission settings", error });
    }
  });

  // Simple booking endpoint for public access
  app.post("/api/bookings", async (req: any, res) => {
    try {
      const bookingData = {
        ...req.body,
        id: Math.random().toString(36).substring(2, 15),
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
      
      res.status(201).json({
        id: bookingData.id,
        status: 'confirmed',
        message: 'Booking created successfully'
      });
    } catch (error: any) {
      console.error("Booking creation error:", error);
      res.status(400).json({ message: "Failed to create booking", error: error.message });
    }
  });

  // Admin: Update rate sheets
  app.put("/api/admin/rates/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedRateSheet = await storage.updateRateSheet(id, updates);
      
      if (!updatedRateSheet) {
        return res.status(404).json({ message: "Rate sheet not found" });
      }
      
      res.json(updatedRateSheet);
    } catch (error) {
      res.status(500).json({ message: "Failed to update rate sheet", error });
    }
  });

  // Admin: Update commission settings
  app.put("/api/admin/commission/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedCommissionSettings = await storage.updateCommissionSettings(id, updates);
      
      if (!updatedCommissionSettings) {
        return res.status(404).json({ message: "Commission settings not found" });
      }
      
      res.json(updatedCommissionSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to update commission settings", error });
    }
  });

  // Admin: Get all rate sheets
  app.get("/api/admin/rates", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const rateSheets = await storage.getAllRateSheets();
      res.json(rateSheets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rate sheets", error });
    }
  });

  // Admin: Get all commission settings
  app.get("/api/admin/commission", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const commissionSettings = await storage.getAllCommissionSettings();
      res.json(commissionSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch commission settings", error });
    }
  });

  // ===== FARE MANAGEMENT API ENDPOINTS =====
  
  // Distance-based Fares API
  app.get("/api/admin/fares/distance", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fares = await storage.getAllFaresByDistance();
      res.json(fares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch distance fares", error });
    }
  });

  app.post("/api/admin/fares/distance", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fareData = insertFareByDistanceSchema.parse(req.body);
      const fare = await storage.createFareByDistance(fareData);
      res.status(201).json(fare);
    } catch (error) {
      res.status(400).json({ message: "Invalid fare data", error });
    }
  });

  app.put("/api/admin/fares/distance/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedFare = await updateDistanceFareWithEmit(id.toString(), updates);
      
      if (!updatedFare) {
        return res.status(404).json({ message: "Distance fare not found" });
      }
      
      res.json(updatedFare);
    } catch (error) {
      res.status(500).json({ message: "Failed to update distance fare", error });
    }
  });

  app.delete("/api/admin/fares/distance/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFareByDistance(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Distance fare not found" });
      }
      
      res.json({ message: "Distance fare deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete distance fare", error });
    }
  });

  // Flat Route Fares API
  app.get("/api/admin/fares/routes", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fares = await storage.getAllFareFlatRoutes();
      res.json(fares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch flat route fares", error });
    }
  });

  app.post("/api/admin/fares/routes", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fareData = insertFareFlatRoutesSchema.parse(req.body);
      const fare = await storage.createFareFlatRoute(fareData);
      res.status(201).json(fare);
    } catch (error) {
      res.status(400).json({ message: "Invalid route fare data", error });
    }
  });

  app.put("/api/admin/fares/routes/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedFare = await updateRouteFareWithEmit(id.toString(), updates);
      
      if (!updatedFare) {
        return res.status(404).json({ message: "Route fare not found" });
      }
      
      res.json(updatedFare);
    } catch (error) {
      res.status(500).json({ message: "Failed to update route fare", error });
    }
  });

  app.delete("/api/admin/fares/routes/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFareFlatRoute(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Route fare not found" });
      }
      
      res.json({ message: "Route fare deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete route fare", error });
    }
  });

  // Hourly Fares API
  app.get("/api/admin/fares/hourly", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fares = await storage.getAllFareHourly();
      res.json(fares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch hourly fares", error });
    }
  });

  app.post("/api/admin/fares/hourly", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fareData = insertFareHourlySchema.parse(req.body);
      const fare = await storage.createFareHourly(fareData);
      res.status(201).json(fare);
    } catch (error) {
      res.status(400).json({ message: "Invalid hourly fare data", error });
    }
  });

  app.put("/api/admin/fares/hourly/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedFare = await updateHourlyFareWithEmit(id.toString(), updates);
      
      if (!updatedFare) {
        return res.status(404).json({ message: "Hourly fare not found" });
      }
      
      res.json(updatedFare);
    } catch (error) {
      res.status(500).json({ message: "Failed to update hourly fare", error });
    }
  });

  app.delete("/api/admin/fares/hourly/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFareHourly(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Hourly fare not found" });
      }
      
      res.json({ message: "Hourly fare deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete hourly fare", error });
    }
  });

  // Extra Fares API
  app.get("/api/admin/fares/extras", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fares = await storage.getAllFareExtras();
      res.json(fares);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch extra fares", error });
    }
  });

  app.post("/api/admin/fares/extras", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const fareData = insertFareExtrasSchema.parse(req.body);
      const fare = await storage.createFareExtra(fareData);
      res.status(201).json(fare);
    } catch (error) {
      res.status(400).json({ message: "Invalid extra fare data", error });
    }
  });

  app.put("/api/admin/fares/extras/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const updatedFare = await updateExtraFareWithEmit(id.toString(), updates);
      
      if (!updatedFare) {
        return res.status(404).json({ message: "Extra fare not found" });
      }
      
      res.json(updatedFare);
    } catch (error) {
      res.status(500).json({ message: "Failed to update extra fare", error });
    }
  });

  app.delete("/api/admin/fares/extras/:id", authenticateToken, authorizeRole(['admin']), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteFareExtra(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Extra fare not found" });
      }
      
      res.json({ message: "Extra fare deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete extra fare", error });
    }
  });

  // Public fare calculation endpoint using new fare tables
  app.post("/api/fares/calculate", async (req, res) => {
    try {
      const { vehicleType, distance, hours, fromLocation, toLocation, extras } = req.body;
      
      // Get all fare types for calculation
      const distanceFares = await storage.getAllFaresByDistance();
      const flatRoutes = await storage.getAllFareFlatRoutes();
      const hourlyFares = await storage.getAllFareHourly();
      const extraFares = await storage.getAllFareExtras();
      
      let totalFare = 0;
      let fareBreakdown = [];
      
      // Check for flat route pricing first
      const flatRoute = flatRoutes.find(route => 
        route.vehicleType === vehicleType &&
        route.isActive &&
        (route.fromLocation.toLowerCase().includes(fromLocation?.toLowerCase()) ||
         route.toLocation.toLowerCase().includes(toLocation?.toLowerCase()))
      );
      
      if (flatRoute) {
        totalFare = parseFloat(flatRoute.price);
        fareBreakdown.push({
          type: 'Flat Route',
          description: `${flatRoute.routeName}`,
          amount: parseFloat(flatRoute.price)
        });
      } else if (hours && hours > 0) {
        // Hourly pricing
        const hourlyFare = hourlyFares.find(fare => 
          fare.vehicleType === vehicleType && fare.isActive
        );
        if (hourlyFare) {
          const hourlyRate = parseFloat(hourlyFare.pricePerHour);
          const billableHours = Math.max(hours, hourlyFare.minimumHours || 1);
          const hourlyTotal = hourlyRate * billableHours;
          totalFare += hourlyTotal;
          fareBreakdown.push({
            type: 'Hourly',
            description: `${billableHours} hours @ €${hourlyRate}/hour`,
            amount: hourlyTotal
          });
        }
      } else if (distance && distance > 0) {
        // Distance-based pricing
        const distanceFare = distanceFares.find(fare => 
          fare.vehicleType === vehicleType
        );
        if (distanceFare) {
          const baseFare = parseFloat(distanceFare.baseFare);
          const perKmRate = parseFloat(distanceFare.perKm);
          const distanceTotal = baseFare + (distance * perKmRate);
          totalFare += distanceTotal;
          fareBreakdown.push({
            type: 'Base Fare',
            description: 'Starting fare',
            amount: baseFare
          });
          fareBreakdown.push({
            type: 'Distance',
            description: `${distance}km @ €${perKmRate}/km`,
            amount: distance * perKmRate
          });
        }
      }
      
      // Add extras
      if (extras && Array.isArray(extras)) {
        extras.forEach(extraId => {
          const extra = extraFares.find(e => 
            e.id === extraId && 
            e.isActive &&
            (e.applicableVehicleTypes === 'all' || e.applicableVehicleTypes.includes(vehicleType))
          );
          if (extra) {
            const extraAmount = parseFloat(extra.price);
            totalFare += extraAmount;
            fareBreakdown.push({
              type: 'Extra',
              description: extra.item,
              amount: extraAmount
            });
          }
        });
      }
      
      res.json({
        totalFare: totalFare.toFixed(2),
        currency: 'EUR',
        currencySymbol: '€',
        breakdown: fareBreakdown
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to calculate fare", error });
    }
  });

  // Object Storage Routes for Driver Documents
  const objectStorageService = new ObjectStorageService();

  // Get upload URL for driver documents
  app.post("/api/drivers/documents/upload-url", authenticateToken, async (req: any, res) => {
    try {
      const { documentType } = req.body;
      
      if (!documentType) {
        return res.status(400).json({ message: "Document type is required" });
      }
      
      const uploadURL = await objectStorageService.getDriverDocumentUploadURL(req.user.id, documentType);
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Update driver document URL after upload
  app.put("/api/drivers/documents", authenticateToken, async (req: any, res) => {
    try {
      const { documentType, documentURL } = req.body;
      
      if (!documentType || !documentURL) {
        return res.status(400).json({ message: "Document type and URL are required" });
      }
      
      // Get or create the driver for this user
      let driver = await storage.getDriverByUserId(req.user.id);
      if (!driver) {
        // Create a basic driver profile if it doesn't exist
        const user = await storage.getUserById(req.user.id);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        
        const driverData = {
          userId: req.user.id,
          licenseNumber: "",
          vehicleType: "sedan",
          vehicleModel: "",
          vehicleColor: "",
          plateNumber: "",
          isAvailable: false,
          verificationStatus: "pending" as const,
          totalEarnings: "0",
          rating: "0",
          totalRides: 0,
          kycStatus: "pending" as const,
          documentsUploaded: false
        };
        
        driver = await storage.createDriver(driverData);
        
        // Update user role to driver if not already
        if (user.role !== 'driver') {
          await storage.updateUser(req.user.id, { role: 'driver' });
        }
      }
      
      // Normalize the object path
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      
      // Update the appropriate document field
      const updateData: any = {};
      switch (documentType) {
        case 'license':
          updateData.licenseDocumentUrl = normalizedPath;
          break;
        case 'registration':
          updateData.vehicleRegistrationUrl = normalizedPath;
          break;
        case 'insurance':
          updateData.insuranceDocumentUrl = normalizedPath;
          break;
        case 'vehicle-photo':
          updateData.vehiclePhotoUrl = normalizedPath;
          break;
        case 'selfie':
          updateData.driverSelfieUrl = normalizedPath;
          break;
        case 'background-check':
          updateData.backgroundCheckUrl = normalizedPath;
          break;
        default:
          return res.status(400).json({ message: "Invalid document type" });
      }
      
      // Check if all documents are uploaded
      const updatedDriver = await storage.updateDriver(driver.id, updateData);
      if (updatedDriver) {
        const allDocsUploaded = updatedDriver.licenseDocumentUrl && 
                              updatedDriver.vehicleRegistrationUrl && 
                              updatedDriver.insuranceDocumentUrl && 
                              updatedDriver.vehiclePhotoUrl && 
                              updatedDriver.driverSelfieUrl && 
                              updatedDriver.backgroundCheckUrl;
        
        if (allDocsUploaded) {
          await storage.updateDriver(driver.id, { documentsUploaded: true });
        }
      }
      
      res.json({ message: "Document uploaded successfully", documentPath: normalizedPath });
    } catch (error) {
      console.error("Error updating driver document:", error);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  // Serve private driver documents (for authorized access)
  app.get("/objects/:objectPath(*)", authenticateToken, async (req: any, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing document:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Serve public assets
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    try {
      const filePath = req.params.filePath;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      await objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send ride invoice after completion
  app.post("/api/rides/:rideId/send-invoice", authenticateToken, async (req: any, res) => {
    try {
      const { rideId } = req.params;
      const ride = await storage.getRide(parseInt(rideId));
      
      if (!ride) {
        return res.status(404).json({ message: "Ride not found" });
      }
      
      if (ride.status !== 'completed') {
        return res.status(400).json({ message: "Can only send invoices for completed rides" });
      }
      
      const customer = await storage.getUser(ride.customerId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      // Send invoice email
      await EmailService.sendRideInvoice(customer, {
        ...ride,
        baseFare: (parseFloat(ride.fare) * 0.6).toFixed(2),
        distanceFare: (parseFloat(ride.fare) * 0.4).toFixed(2),
        extraCharges: 0,
        totalFare: ride.fare,
        createdAt: ride.requestTime
      });
      
      res.json({ message: "Invoice sent successfully" });
    } catch (error) {
      console.error("Error sending invoice:", error);
      res.status(500).json({ message: "Failed to send invoice" });
    }
  });

  // Partner application endpoint
app.post("/api/partner/apply", async (req, res) => {
  try {
    const {
      fullName,
      email,
      company = "",
      website = "",
      country = "",
      payoutMethod = "",
      description = ""
    } = req.body || {};

    // ✅ Required fields check
    if (!fullName || !email || !website || !country || !payoutMethod || !description) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled"
      });
    }

    // ✅ 1) DB me 'pending' save (single source of truth)
    try {
      const { storage } = await import("./storage");
      if (typeof storage.createPartnerApplication === "function") {
        await storage.createPartnerApplication({
          fullName,
          email,
          company,
          website,
          country,
          payoutMethod,
          description,
        });
      } else {
        console.warn("storage.createPartnerApplication not found");
      }
    } catch (e) {
      console.error("DB save failed (non-blocking):", e);
      // Note: DB fail pe bhi emails bhej dete hain taa-ke notification mil jaye
    }

    // ✅ 2) Applicant ko confirmation email
    try {
      await EmailService.sendPartnerApplicationConfirmation({
        email,
        fullName,
        company,
        website,
        country,
        payoutMethod,
        description
      });
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    // ✅ 3) Admin ko notification email (partners@vitecab.com)
    try {
      await EmailService.sendPartnerApplicationNotification({
        email,
        fullName,
        company,
        website,
        country,
        payoutMethod,
        description
      });
    } catch (emailError) {
      console.error("Failed to send admin notification:", emailError);
    }

    // ✅ 4) Final success JSON (HTTP 200)
    return res.json({
      success: true,
      message: "Application submitted successfully. We'll review it within 24–48 hours.",
    });

  } catch (err) {
    console.error("partner/apply error:", err);
    // ❗️Outer catch → HTTP 500 JSON
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

  // Partner approval endpoint (for admin use)
  app.post('/api/partner/approve', authenticateToken, async (req, res) => {
    try {
      const { email, fullName, tempPassword } = req.body;
      
      // Check if user is admin
      const currentUser = await storage.getUser(req.user?.id);
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Generate a secure temporary password if not provided
      let generatedPassword = tempPassword || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      let partnerUser;

      if (existingUser) {
        // Update existing user to partner role
        partnerUser = await storage.updateUserRole(existingUser.id, 'partner');
        
        // Update password if provided, otherwise use existing password
        if (tempPassword) {
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          await storage.updateUser(existingUser.id, { password: hashedPassword });
          generatedPassword = tempPassword;
        } else {
          // Keep existing password, notify user to use current password
          generatedPassword = 'existing-password';
        }
      } else {
        // Create new partner user account
        partnerUser = await storage.createUser({
          name: fullName,
          email: email,
          password: await bcrypt.hash(generatedPassword, 10),
          role: 'partner',
          isVerified: true
        });
      }

      // Send welcome email with login credentials
      const welcomeEmailSent = await EmailService.sendPartnerWelcomeEmail({
        email: email,
        fullName: fullName,
        tempPassword: generatedPassword,
        isExistingUser: !!existingUser
      });

      if (welcomeEmailSent) {
        res.json({
          message: existingUser ? 
            'Existing user upgraded to Partner successfully! Instructions sent via email.' :
            'Partner approved successfully! Login credentials sent via email.',
          success: true,
          partnerId: partnerUser.id,
          isExistingUser: !!existingUser
        });
      } else {
        res.json({
          message: 'Partner account created but email failed to send. Please contact partner manually.',
          success: true,
          partnerId: partnerUser.id,
          tempPassword: generatedPassword === 'existing-password' ? 'Use existing password' : generatedPassword,
          isExistingUser: !!existingUser
        });
      }
    } catch (error) {
      console.error('Error approving partner:', error);
      res.status(500).json({ error: 'Failed to approve partner' });
    }
  });

  // Email notification route
  app.post("/api/send-booking-email", async (req, res) => {
    try {
      const { bookingId, email, bookingDetails } = req.body;
      
      const success = await sendBookingConfirmation({
        to: email,
        bookingId,
        bookingDetails
      });

      if (success) {
        res.json({ success: true, message: "Email sent successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to send email" });
      }
    } catch (error: any) {
      console.error("Email error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Profile management routes
  app.put("/api/auth/profile", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { name, email, phone } = req.body;
      
      const updatedUser = await storage.updateUser(userId, {
        name,
        email,
        phone
      });

      if (updatedUser) {
        res.json({ 
          message: "Profile updated successfully",
          user: updatedUser 
        });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Change password route
  app.put("/api/auth/change-password", authenticateToken, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      // Get current user
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password
      const updatedUser = await storage.updateUser(userId, {
        password: hashedNewPassword
      });

      if (updatedUser) {
        res.json({ message: "Password changed successfully" });
      } else {
        res.status(500).json({ error: "Failed to update password" });
      }
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // Profile image upload route
  app.post(
  "/api/auth/upload-profile-image",
  authenticateToken,
  upload.single("profileImage"),
  async (req: any, res) => {
    try {
      const userId = req.user.id;
      if (!req.file) return res.status(400).json({ error: "No image file provided" });

      const result: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "profile_images",
            public_id: `user_${userId}_${Date.now()}`,
            transformation: [
              { width: 400, height: 400, crop: "fill", gravity: "face" },
              { quality: "auto", fetch_format: "auto" },
            ],
          },
          (err, res) => (err ? reject(err) : resolve(res))
        );
        stream.end(req.file.buffer);
      });

      const updatedUser = await storage.updateUser(userId, { profileImage: result.secure_url });
      if (!updatedUser) return res.status(500).json({ error: "Failed to update profile image" });

      return res.json({ message: "Profile image updated successfully", profileImage: result.secure_url });
    } catch (error) {
      console.error("Error uploading profile image:", error);
      return res.status(500).json({ error: "Failed to upload profile image" });
    }
  }
);
  // Partner driver management routes
  // Get partner's drivers
  app.get("/api/partner/drivers", authenticateToken, authorizeRole(['partner']), async (req: any, res) => {
    try {
      const partnerId = req.user.id;
      // Get all drivers associated with this partner
      const drivers = await storage.getDriversByPartnerId(partnerId);
      res.json(drivers);
    } catch (error) {
      console.error('Error fetching partner drivers:', error);
      res.status(500).json({ error: 'Failed to fetch drivers' });
    }
  });

  // Add new driver to partner's fleet
  app.post("/api/partner/drivers", authenticateToken, authorizeRole(['partner']), async (req: any, res) => {
    try {
      const partnerId = req.user.id;
      const driverData = req.body;
      
      // Create user account for driver
      const hashedPassword = await bcrypt.hash(driverData.password, 10);
      const user = await storage.createUser({
        ...driverData,
        password: hashedPassword,
        role: 'driver',
        partnerId: partnerId, // Associate with partner
        emailVerified: true
      });

      // Create driver profile
      const driver = await storage.createDriver({
        userId: user.id,
        licenseNumber: driverData.licenseNumber,
        vehicleType: driverData.vehicleType,
        vehicleModel: driverData.vehicleModel,
        vehicleColor: driverData.vehicleColor,
        plateNumber: driverData.plateNumber,
        country: driverData.country,
        city: driverData.city,
        carClass: driverData.carClass,
        baseRatePerKm: driverData.baseRatePerKm,
        tvaRate: driverData.tvaRate,
        kycStatus: 'pending',
        partnerId: partnerId
      });

      res.json(driver);
    } catch (error) {
      console.error('Error adding driver:', error);
      res.status(500).json({ error: 'Failed to add driver' });
    }
  });

  // Update driver rates
  app.put("/api/partner/drivers/:id/rates", authenticateToken, authorizeRole(['partner']), async (req: any, res) => {
    try {
      const partnerId = req.user.id;
      const driverId = parseInt(req.params.id);
      const { baseRatePerKm, tvaRate } = req.body;
      
      // Verify driver belongs to this partner
      const driver = await storage.getDriverById(driverId);
      if (!driver || driver.partnerId !== partnerId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedDriver = await storage.updateDriver(driverId, {
        baseRatePerKm,
        tvaRate
      });

      res.json(updatedDriver);
    } catch (error) {
      console.error('Error updating driver rates:', error);
      res.status(500).json({ error: 'Failed to update rates' });
    }
  });

  // Update driver status (approve/reject)
  app.put("/api/partner/drivers/:id/status", authenticateToken, authorizeRole(['partner']), async (req: any, res) => {
    try {
      const partnerId = req.user.id;
      const driverId = parseInt(req.params.id);
      const { status } = req.body;
      
      // Verify driver belongs to this partner
      const driver = await storage.getDriverById(driverId);
      if (!driver || driver.partnerId !== partnerId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedDriver = await storage.updateDriver(driverId, {
        kycStatus: status,
        isVerified: status === 'approved'
      });

      res.json(updatedDriver);
    } catch (error) {
      console.error('Error updating driver status:', error);
      res.status(500).json({ error: 'Failed to update status' });
    }
  });

  // Setup driver payout
  app.put("/api/partner/drivers/:id/payout", authenticateToken, authorizeRole(['partner']), async (req: any, res) => {
    try {
      const partnerId = req.user.id;
      const driverId = parseInt(req.params.id);
      const payoutData = req.body;
      
      // Verify driver belongs to this partner
      const driver = await storage.getDriverById(driverId);
      if (!driver || driver.partnerId !== partnerId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updatedDriver = await storage.updateDriver(driverId, {
        paymentMethod: payoutData.paymentMethod,
        bankName: payoutData.bankName,
        accountNumber: payoutData.accountNumber,
        iban: payoutData.iban,
        bic: payoutData.bic,
        paypalEmail: payoutData.paypalEmail,
        bankingVerified: true
      });

      res.json(updatedDriver);
    } catch (error) {
      console.error('Error setting up payout:', error);
      res.status(500).json({ error: 'Failed to setup payout' });
    }
  });

  // Delete driver
  app.delete("/api/partner/drivers/:id", authenticateToken, authorizeRole(['partner']), async (req: any, res) => {
    try {
      const partnerId = req.user.id;
      const driverId = parseInt(req.params.id);
      
      // Verify driver belongs to this partner
      const driver = await storage.getDriverById(driverId);
      if (!driver || driver.partnerId !== partnerId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete driver and associated user account
      await storage.deleteDriver(driverId);
      await storage.deleteUser(driver.userId);

      res.json({ message: 'Driver deleted successfully' });
    } catch (error) {
      console.error('Error deleting driver:', error);
      res.status(500).json({ error: 'Failed to delete driver' });
    }
  });

  // Booking submission endpoint with email notifications
app.post("/api/bookings/submit", async (req, res) => {
  try {
    const {
      pickup,
      dropoff,
      date,
      time,
      vehicle,
      passengers,
      customer,
      flight,
      extras,
      total,
      paymentMethod,
    } = req.body;

    // Validate required fields
    if (!pickup || !dropoff || !vehicle || !customer?.name || !customer?.email) {
      return res.status(400).json({ error: "Missing required booking information" });
    }

    // Generate unique booking ID
    const bookingId =
      `VTC${Date.now()}` + Math.random().toString(36).substr(2, 3).toUpperCase();

    // Send customer confirmation email (best-effort)
    try {
      await sendBookingConfirmation({
        to: customer.email,
        bookingId,
        bookingDetails: {
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          vehicleType: vehicle,
          bookingType: date === "Now" ? "now" : "later",
          pickupDate: date !== "Now" ? date : undefined,
          pickupTime: time !== "Immediate" ? time : undefined,
          passengers: String(passengers),
          totalAmount: total,
          currency: "EUR",
          paymentMethod,
        },
      });
    } catch (e) {
      console.error("Failed to send customer email:", e);
    }

    // Send admin notification (best-effort)
    try {
      await sendBookingConfirmation({
        to: "admin@vitecab.com",
        bookingId,
        bookingDetails: {
          pickupLocation: pickup,
          dropoffLocation: dropoff,
          vehicleType: vehicle,
          bookingType: date === "Now" ? "now" : "later",
          pickupDate: date !== "Now" ? date : undefined,
          pickupTime: time !== "Immediate" ? time : undefined,
          passengers: String(passengers),
          totalAmount: total,
          currency: "EUR",
          paymentMethod,
        },
      });
    } catch (e) {
      console.error("Failed to send admin email:", e);
    }

    return res.json({
      success: true,
      bookingId,
      message: `Booking confirmed! Confirmation sent to ${customer.email}`,
      bookingDetails: {
        pickup,
        dropoff,
        date,
        time,
        vehicle,
        customer,
        flight,
        extras,
        total,
        paymentMethod,
      },
    });
  } catch (error) {
    console.error("Booking submission error:", error);
    return res.status(500).json({
      error: "Failed to process booking",
      message: "Please try again or contact support",
    });
  }
});

const httpServer = createServer(app);
return httpServer;
}