import prisma from "../config/prismaClient.js";
import helper from "../helper/helper.js";

const ACCOUNT_TYPES = {
  Client: 1,
  Designer: 2,
  Architect: 3,
  Contractor: 4,
  MaterialSupplier: 5,
};

const ACCOUNT_TYPE_NAMES = Object.fromEntries(
  Object.entries(ACCOUNT_TYPES).map(([name, code]) => [code, name]),
);

const FIELD_LIMITS = {
  sku: 50,
  productName: 150,
  category: 60,
  subCategory: 60,
  brand: 60,
  description: 1000,
  specifications: 2000,
  unit: 30,
  material: 60,
  color: 40,
  warranty: 100,
  deliveryTime: 100,
  thumbnail: 500,
};

function validateFieldLengths(body) {
  const errors = [];
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    const val = body[field];
    if (typeof val === "string" && val.length > max) {
      errors.push(`${field} must not exceed ${max} characters`);
    }
  }
  if (Array.isArray(body.images) && body.images.length > 10) {
    errors.push("images must not exceed 10 items");
  }
  return errors;
}

class MaterialSupplierController {
  static async getUserDetails(req, res, next) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          countryCode: true,
          role: true,
          country: true,
          state: true,
          city: true,
          address: true,
          activeDate: true,
          isVerified: true,
          isBlocked: true,
          wallets: {
            select: {
              totalAvailableBalance: true,
            },
          },
        },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      const totalProducts = await prisma.product.count({
        where: { supplierId: userId },
      });

      const activeProducts = await prisma.product.count({
        where: { supplierId: userId, status: "Active" },
      });

      const outOfStockProducts = await prisma.product.count({
        where: { supplierId: userId, availability: "Out of Stock" },
      });

      return helper.success(res, "User details fetched successfully", {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: ACCOUNT_TYPE_NAMES[user.role] ?? "Unknown",
        country: user.country,
        state: user.state,
        city: user.city,
        address: user.address,
        walletBalance: user.walletBalance,
        productStats: {
          totalProducts,
          activeProducts,
          outOfStockProducts,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // ---------------- CREATE PRODUCT ----------------
  // ---------------- CREATE PRODUCT ----------------
  static async createProduct(req, res, next) {
    try {
      const supplierId = req.user.id;

      const {
        sku,
        productName,
        category,
        subCategory,
        brand,
        description,
        specifications,
        unit,
        price,
        discountPrice,
        stock,
        minimumOrderQuantity,
        images,
        thumbnail,
        material,
        color,
        length,
        width,
        height,
        weight,
        warranty,
        deliveryTime,
        availability,
        status,
      } = req.body;

      if (!productName || !category || !unit || price === undefined) {
        return helper.failed(
          res,
          "productName, category, unit and price are required",
        );
      }

      const lengthErrors = validateFieldLengths(req.body);
      if (lengthErrors.length > 0) {
        return helper.failed(res, lengthErrors.join("; "));
      }

      if (sku) {
        const existingSku = await prisma.product.findUnique({ where: { sku } });
        if (existingSku) {
          return helper.failed(res, "SKU already exists");
        }
      }

      const product = await prisma.product.create({
        data: {
          supplierId,
          sku: sku || undefined,
          productName,
          category,
          subCategory,
          brand,
          description,
          specifications,
          unit,
          price: Number(price),
          discountPrice:
            discountPrice !== undefined ? Number(discountPrice) : undefined,
          stock: stock !== undefined ? Number(stock) : 0,
          minimumOrderQuantity:
            minimumOrderQuantity !== undefined
              ? Number(minimumOrderQuantity)
              : 1,
          images: Array.isArray(images) ? images : [],
          thumbnail,
          material,
          color,
          length: length !== undefined ? Number(length) : undefined,
          width: width !== undefined ? Number(width) : undefined,
          height: height !== undefined ? Number(height) : undefined,
          weight: weight !== undefined ? Number(weight) : undefined,
          warranty,
          deliveryTime,
          availability: availability || "In Stock",
          status: status || "Active",
          createdBy: supplierId,
          updatedBy: supplierId,
        },
      });

      return helper.success(res, "Product created successfully", product);
    } catch (error) {
      next(error);
    }
  }

  // ---------------- GET ALL PRODUCTS (own) ----------------
  static async getAllProducts(req, res, next) {
    try {
      const supplierId = req.user.id;
      const {
        page = 1,
        limit = 10,
        search = "",
        status,
        availability,
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        supplierId,
        ...(search && {
          productName: { contains: search, mode: "insensitive" },
        }),
        ...(status && { status }),
        ...(availability && { availability }),
      };

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({ where }),
      ]);

      return helper.success(res, "Products fetched successfully", {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (error) {
      next(error);
    }
  }

  // ---------------- GET SINGLE PRODUCT ----------------
  static async getProductById(req, res, next) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      const product = await prisma.product.findFirst({
        where: { id, supplierId },
      });

      if (!product) {
        return helper.failed(res, "Product not found");
      }

      return helper.success(res, "Product fetched successfully", product);
    } catch (error) {
      next(error);
    }
  }

  // ---------------- UPDATE PRODUCT ----------------
  static async updateProduct(req, res, next) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      const existingProduct = await prisma.product.findFirst({
        where: { id, supplierId },
      });

      if (!existingProduct) {
        return helper.failed(
          res,
          "Product not found or you don't have permission to edit it",
        );
      }

      const {
        sku,
        productName,
        category,
        subCategory,
        brand,
        description,
        specifications,
        unit,
        price,
        discountPrice,
        stock,
        minimumOrderQuantity,
        images,
        thumbnail,
        material,
        color,
        length,
        width,
        height,
        weight,
        warranty,
        deliveryTime,
        availability,
        status,
      } = req.body;

      if (sku && sku !== existingProduct.sku) {
        const existingSku = await prisma.product.findUnique({ where: { sku } });
        if (existingSku) {
          return helper.failed(res, "SKU already exists");
        }
      }

      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          ...(sku !== undefined && { sku }),
          ...(productName !== undefined && { productName }),
          ...(category !== undefined && { category }),
          ...(subCategory !== undefined && { subCategory }),
          ...(brand !== undefined && { brand }),
          ...(description !== undefined && { description }),
          ...(specifications !== undefined && { specifications }),
          ...(unit !== undefined && { unit }),
          ...(price !== undefined && { price: Number(price) }),
          ...(discountPrice !== undefined && {
            discountPrice: Number(discountPrice),
          }),
          ...(stock !== undefined && { stock: Number(stock) }),
          ...(minimumOrderQuantity !== undefined && {
            minimumOrderQuantity: Number(minimumOrderQuantity),
          }),
          ...(images !== undefined && {
            images: Array.isArray(images) ? images : existingProduct.images,
          }),
          ...(thumbnail !== undefined && { thumbnail }),
          ...(material !== undefined && { material }),
          ...(color !== undefined && { color }),
          ...(length !== undefined && { length: Number(length) }),
          ...(width !== undefined && { width: Number(width) }),
          ...(height !== undefined && { height: Number(height) }),
          ...(weight !== undefined && { weight: Number(weight) }),
          ...(warranty !== undefined && { warranty }),
          ...(deliveryTime !== undefined && { deliveryTime }),
          ...(availability !== undefined && { availability }),
          ...(status !== undefined && { status }),
          updatedBy: supplierId,
        },
      });

      return helper.success(
        res,
        "Product updated successfully",
        updatedProduct,
      );
    } catch (error) {
      next(error);
    }
  }

  // ---------------- DELETE PRODUCT ----------------
  static async deleteProduct(req, res, next) {
    try {
      const supplierId = req.user.id;
      const { id } = req.params;

      const existingProduct = await prisma.product.findFirst({
        where: { id, supplierId },
      });

      if (!existingProduct) {
        return helper.failed(
          res,
          "Product not found or you don't have permission to delete it",
        );
      }

      await prisma.product.delete({ where: { id } });

      return helper.success(res, "Product deleted successfully", { id });
    } catch (error) {
      next(error);
    }
  }

  // ---------------- GET ALL PRODUCTS (PUBLIC - landing page) ----------------
  // Supports: text search on product fields, category/brand/price filters,
  // AND a plain text location search (locationQuery) matched directly against
  // ContactDetails (state / city / address / mapAddress / pincode) via `contains`.
  // No geocoding, no lat/lng, no radius math — just: does the typed text
  // match something in the supplier's location details? If yes, return their products.
  static async getPublicProducts(req, res, next) {
    try {
      const {
        page = 1,
        limit = 12,
        search = "",
        category,
        subCategory,
        brand,
        minPrice,
        maxPrice,
        availability,
        sortBy = "createdAt",
        sortOrder = "desc",
        locationQuery,
      } = req.body;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
      const skip = (pageNum - 1) * limitNum;

      const trimmedLocation =
        typeof locationQuery === "string" ? locationQuery.trim() : "";

      let supplierIds = null; // null => no location restriction

      if (trimmedLocation) {
        const contacts = await prisma.contactDetails.findMany({
          where: {
            OR: [
              { state: { contains: trimmedLocation, mode: "insensitive" } },
              { city: { contains: trimmedLocation, mode: "insensitive" } },
              { address: { contains: trimmedLocation, mode: "insensitive" } },
              {
                mapAddress: { contains: trimmedLocation, mode: "insensitive" },
              },
              { pincode: { contains: trimmedLocation, mode: "insensitive" } },
            ],
          },
          select: { supplierId: true },
        });

        supplierIds = contacts.map((c) => c.supplierId);

        if (supplierIds.length === 0) {
          return helper.success(res, "Products fetched successfully", {
            suppliers: [],
            contactDetails: [],
            products: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0,
          });
        }
      }

      const trimmedSearch = typeof search === "string" ? search.trim() : "";

      const where = {
        status: "Active",
        ...(supplierIds && { supplierId: { in: supplierIds } }),
        ...(trimmedSearch && {
          OR: [
            { productName: { contains: trimmedSearch, mode: "insensitive" } },
            { category: { contains: trimmedSearch, mode: "insensitive" } },
            { subCategory: { contains: trimmedSearch, mode: "insensitive" } },
            { brand: { contains: trimmedSearch, mode: "insensitive" } },
          ],
        }),
        ...(category && { category }),
        ...(subCategory && { subCategory }),
        ...(brand && { brand }),
        ...(availability && { availability }),
        ...((minPrice || maxPrice) && {
          price: {
            ...(minPrice && { gte: Number(minPrice) }),
            ...(maxPrice && { lte: Number(maxPrice) }),
          },
        }),
      };

      const allowedSortFields = ["createdAt", "price", "productName", "stock"];
      const orderByField = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const orderByDirection = sortOrder === "asc" ? "asc" : "desc";

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { [orderByField]: orderByDirection },
        }),
        prisma.product.count({ where }),
      ]);

      const uniqueSupplierIds = [...new Set(products.map((p) => p.supplierId))];

      const [suppliers, contactDetails] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: uniqueSupplierIds } },
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            phone: true,
            countryCode: true,
            city: true,
            state: true,
            country: true,
            address: true,
            isVerified: true,
          },
        }),
        prisma.contactDetails.findMany({
          where: { supplierId: { in: uniqueSupplierIds } },
        }),
      ]);

      return helper.success(res, "Products fetched successfully", {
        suppliers,
        contactDetails,
        products,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      next(error);
    }
  }

  // ---------------- GET ALL PRODUCTS BY A SPECIFIC SUPPLIER (PUBLIC) ----------------
  static async getProductsBySupplierId(req, res, next) {
    try {
      const { supplierId } = req.params;
      const { page = 1, limit = 12, search = "" } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        supplierId,
        status: "Active",
        ...(search && {
          productName: { contains: search, mode: "insensitive" },
        }),
      };

      const [supplier, products, total] = await Promise.all([
        prisma.user.findUnique({
          where: { id: supplierId },
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            country: true,
            isVerified: true,
          },
        }),
        prisma.product.findMany({
          where,
          skip,
          take: Number(limit),
          orderBy: { createdAt: "desc" },
        }),
        prisma.product.count({ where }),
      ]);

      if (!supplier) {
        return helper.failed(res, "Supplier not found");
      }

      return helper.success(res, "Supplier products fetched successfully", {
        supplier,
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
      });
    } catch (error) {
      next(error);
    }
  }

  // ---------------- GEOCODE (autocomplete location search) ----------------
  // GET /materialSupplier/public/geocode?query=MG Road, Bangalore
  // NOTE: this is now used purely for showing autocomplete SUGGESTIONS in the
  // search box (nice place names as you type). The lat/lng it returns are
  // NOT sent to getPublicProducts anymore — only the displayName text is,
  // which getPublicProducts matches against ContactDetails via `contains`.
  static async geocodeLocation(req, res, next) {
    try {
      const { query, limit = 5 } = req.query;

      if (!query || !query.trim()) {
        return helper.failed(res, "Query is required");
      }

      const trimmedQuery = query.trim();

      if (trimmedQuery.length < 2) {
        return helper.success(res, "Locations fetched", []);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      let response;
      try {
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            trimmedQuery,
          )}&limit=${Math.min(10, Number(limit) || 5)}&addressdetails=1&countrycodes=in`,
          {
            headers: {
              "User-Agent": "Karrivo/1.0 (contact@karrivo.com)", // REQUIRED — Nominatim blocks generic/missing UA
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeoutId);
      }

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error(
          "Nominatim non-JSON response:",
          response.status,
          text.slice(0, 200),
        );
        return helper.failed(
          res,
          "Location search is temporarily unavailable. Please try again.",
        );
      }

      const data = await response.json();

      const results = data
        .filter((r) => r.lat && r.lon)
        .map((r) => ({
          displayName: r.display_name,
          lat: Number(r.lat),
          lng: Number(r.lon),
          state: r.address?.state || null,
          city:
            r.address?.city || r.address?.town || r.address?.village || null,
          country: r.address?.country || null,
        }));

      return helper.success(res, "Locations fetched", results);
    } catch (error) {
      if (error.name === "AbortError") {
        return helper.failed(
          res,
          "Location search timed out. Please try again.",
        );
      }
      next(error);
    }
  }

  static async createContactDetails(req, res, next) {
    try {
      const supplierId = req.user.id;

      const existing = await prisma.contactDetails.findUnique({
        where: { supplierId },
      });

      if (existing) {
        return helper.failed(
          res,
          "Contact details already exist. Please update instead.",
        );
      }

      const {
        shopName,
        address,
        pincode,
        state,
        city,
        country,
        latitude,
        longitude,
        mapAddress,
        whatsappNumber,
        callNumber,
        email,
      } = req.body;

      if (
        !shopName ||
        !address ||
        !pincode ||
        !state ||
        !city ||
        !whatsappNumber ||
        !callNumber ||
        !email
      ) {
        return helper.failed(
          res,
          "shopName, address, pincode, state, city, whatsappNumber, callNumber and email are required",
        );
      }

      const contact = await prisma.contactDetails.create({
        data: {
          supplierId,
          shopName,
          address,
          pincode,
          state,
          city,
          country: country || "India",
          latitude: latitude !== undefined ? Number(latitude) : undefined,
          longitude: longitude !== undefined ? Number(longitude) : undefined,
          mapAddress,
          whatsappNumber,
          callNumber,
          email,
        },
      });

      return helper.success(
        res,
        "Contact details created successfully",
        contact,
      );
    } catch (error) {
      next(error);
    }
  }

  // ---------------- GET (own) ----------------
  static async getContactDetails(req, res, next) {
    try {
      const supplierId = req.user.id;

      const contact = await prisma.contactDetails.findUnique({
        where: { supplierId },
      });

      if (!contact) {
        return helper.failed(res, "Contact details not found", {}, 400);
      }

      return helper.success(
        res,
        "Contact details fetched successfully",
        contact,
      );
    } catch (error) {
      next(error);
    }
  }

  // ---------------- UPDATE ----------------
  static async updateContactDetails(req, res, next) {
    try {
      const supplierId = req.user.id;

      const existing = await prisma.contactDetails.findUnique({
        where: { supplierId },
      });

      if (!existing) {
        return helper.failed(
          res,
          "Contact details not found. Please create first.",
        );
      }

      const {
        shopName,
        address,
        pincode,
        state,
        city,
        country,
        latitude,
        longitude,
        mapAddress,
        whatsappNumber,
        callNumber,
        email,
      } = req.body;

      const updated = await prisma.contactDetails.update({
        where: { supplierId },
        data: {
          ...(shopName !== undefined && { shopName }),
          ...(address !== undefined && { address }),
          ...(pincode !== undefined && { pincode }),
          ...(state !== undefined && { state }),
          ...(city !== undefined && { city }),
          ...(country !== undefined && { country }),
          ...(latitude !== undefined && { latitude: Number(latitude) }),
          ...(longitude !== undefined && { longitude: Number(longitude) }),
          ...(mapAddress !== undefined && { mapAddress }),
          ...(whatsappNumber !== undefined && { whatsappNumber }),
          ...(callNumber !== undefined && { callNumber }),
          ...(email !== undefined && { email }),
        },
      });

      return helper.success(
        res,
        "Contact details updated successfully",
        updated,
      );
    } catch (error) {
      next(error);
    }
  }

  // ---------------- DELETE ----------------
  static async deleteContactDetails(req, res, next) {
    try {
      const supplierId = req.user.id;

      const existing = await prisma.contactDetails.findUnique({
        where: { supplierId },
      });

      if (!existing) {
        return helper.failed(res, "Contact details not found");
      }

      await prisma.contactDetails.delete({ where: { supplierId } });

      return helper.success(res, "Contact details deleted successfully", {
        supplierId,
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /api/materialSupplier/me/profile
  static async getMyProfile(req, res) {
    try {
      const userId = req.user.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      const contact = await prisma.contactDetails.findUnique({
        where: { supplierId: userId },
      });

      const totalProducts = await prisma.product.count({
        where: { supplierId: userId },
      });

      return helper.success(res, "Supplier profile fetched successfully", {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        country: user.country || contact?.country || "India",
        state: user.state || contact?.state || "",
        city: user.city || contact?.city || "",
        address: user.address || contact?.address || "",
        shopName: contact?.shopName || user.name || "",
        pincode: contact?.pincode || "",
        mapAddress: contact?.mapAddress || "",
        whatsappNumber: contact?.whatsappNumber || user.phone || "",
        callNumber: contact?.callNumber || user.phone || "",
        businessEmail: contact?.email || user.email || "",
        latitude: contact?.latitude || null,
        longitude: contact?.longitude || null,
        totalProducts,
      });
    } catch (err) {
      console.error("MaterialSupplierController.getMyProfile error:", err);
      return helper.failed(res, "Failed to fetch supplier profile");
    }
  }

  // PATCH /api/materialSupplier/me/profile
  static async editMyProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return helper.failed(res, "User not found");
      }

      if (user.role !== 5) {
        return helper.failed(res, "Only material suppliers can update supplier profile");
      }

      const {
        name,
        phone,
        countryCode,
        country,
        state,
        city,
        address,
        shopName,
        pincode,
        mapAddress,
        whatsappNumber,
        callNumber,
        businessEmail,
        latitude,
        longitude,
      } = req.body;

      const updated = await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            ...(name !== undefined && { name: String(name).trim() }),
            ...(phone !== undefined && { phone: String(phone).trim() }),
            ...(countryCode !== undefined && { countryCode: String(countryCode).trim() }),
            ...(country !== undefined && { country: String(country).trim() }),
            ...(state !== undefined && { state: String(state).trim() }),
            ...(city !== undefined && { city: String(city).trim() }),
            ...(address !== undefined && { address: String(address).trim() }),
          },
        });

        const contactData = {
          shopName: shopName ? String(shopName).trim() : (name ? String(name).trim() : user.name),
          address: address ? String(address).trim() : (user.address || ""),
          pincode: pincode ? String(pincode).trim() : "",
          state: state ? String(state).trim() : (user.state || ""),
          city: city ? String(city).trim() : (user.city || ""),
          country: country ? String(country).trim() : (user.country || "India"),
          mapAddress: mapAddress ? String(mapAddress).trim() : null,
          whatsappNumber: whatsappNumber ? String(whatsappNumber).trim() : (phone ? String(phone).trim() : user.phone),
          callNumber: callNumber ? String(callNumber).trim() : (phone ? String(phone).trim() : user.phone),
          email: businessEmail ? String(businessEmail).trim() : user.email,
          latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
          longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null,
        };

        const updatedContact = await tx.contactDetails.upsert({
          where: { supplierId: userId },
          update: {
            ...(shopName !== undefined && { shopName: String(shopName).trim() }),
            ...(address !== undefined && { address: String(address).trim() }),
            ...(pincode !== undefined && { pincode: String(pincode).trim() }),
            ...(state !== undefined && { state: String(state).trim() }),
            ...(city !== undefined && { city: String(city).trim() }),
            ...(country !== undefined && { country: String(country).trim() }),
            ...(mapAddress !== undefined && { mapAddress: String(mapAddress).trim() }),
            ...(whatsappNumber !== undefined && { whatsappNumber: String(whatsappNumber).trim() }),
            ...(callNumber !== undefined && { callNumber: String(callNumber).trim() }),
            ...(businessEmail !== undefined && { email: String(businessEmail).trim() }),
            ...(latitude !== undefined && { latitude: latitude !== null ? Number(latitude) : null }),
            ...(longitude !== undefined && { longitude: longitude !== null ? Number(longitude) : null }),
          },
          create: {
            supplierId: userId,
            ...contactData,
          },
        });

        return { user: updatedUser, contactDetails: updatedContact };
      });

      return helper.success(res, "Supplier profile updated successfully", updated);
    } catch (err) {
      console.error("MaterialSupplierController.editMyProfile error:", err);
      return helper.failed(res, err?.message || "Failed to update supplier profile");
    }
  }
}

export default MaterialSupplierController;
