// --- DEFAULTS & SEED DATA ---
const DEFAULT_SETTINGS = {
  name: "Madhusudanam Palace",
  phone: "9413186156",
  whatsapp: "8619687476",
  address: "Tahsil Road, Purani Delhi Public School, Mangrol"
};

const DEFAULT_CREDENTIALS = {
  username: "admin@madhusudanam.com",
  password: "adminpassword"
};

const DEFAULT_ROOMS = [
  {
    id: "r1",
    name: "Royal Deluxe AC Suite",
    type: "ac",
    price: 3200,
    description: "Experience royal luxury in our premium air-conditioned suite. Features a king-size plush bed, elegant decor, writing desk, smart TV, and 24/7 service.",
    image: "https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80",
    amenities: ["Air Conditioning", "Free WiFi", "Smart TV", "Mini Fridge", "Royal Decor", "24/7 Service"]
  },
  {
    id: "r2",
    name: "Heritage Non-AC Comfort",
    type: "non-ac",
    price: 1800,
    description: "A spacious and well-ventilated heritage room featuring traditional Rajasthani architecture, cooler ventilation, double bed, and premium bedding.",
    image: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
    amenities: ["Spacious Balcony", "Free WiFi", "Cable TV", "Room Cooler", "Premium Bedding"]
  },
  {
    id: "r3",
    name: "Classic Fan-Only Saver",
    type: "fan",
    price: 999,
    description: "Budget-friendly classic room equipped with dual high-speed ceiling fans, clean double bed, intercom, and tidy linens. Ideal for short stays.",
    image: "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
    amenities: ["High-speed Fan", "Free WiFi", "Intercom", "Attached Bath", "Clean Linen"]
  }
];

const DEFAULT_GALLERY = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4db85b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80"
];

// --- APP STATE ---
let settings = {};
let rooms = [];
let gallery = [];
let bookings = [];
let adminCredentials = {};
let currentRoomIdForBooking = null;
let currentRoomIdForEditing = null;

// --- INITIALIZE DATA ---
function initData() {
  // Load settings
  if (!localStorage.getItem("mp_settings")) {
    localStorage.setItem("mp_settings", JSON.stringify(DEFAULT_SETTINGS));
  }
  settings = JSON.parse(localStorage.getItem("mp_settings"));

  // Load credentials
  if (!localStorage.getItem("mp_credentials")) {
    localStorage.setItem("mp_credentials", JSON.stringify(DEFAULT_CREDENTIALS));
  }
  adminCredentials = JSON.parse(localStorage.getItem("mp_credentials"));

  // Load rooms
  if (!localStorage.getItem("mp_rooms")) {
    localStorage.setItem("mp_rooms", JSON.stringify(DEFAULT_ROOMS));
  }
  rooms = JSON.parse(localStorage.getItem("mp_rooms"));

  // Load gallery
  if (!localStorage.getItem("mp_gallery")) {
    localStorage.setItem("mp_gallery", JSON.stringify(DEFAULT_GALLERY));
  }
  gallery = JSON.parse(localStorage.getItem("mp_gallery"));

  // Load bookings list
  if (!localStorage.getItem("mp_bookings")) {
    localStorage.setItem("mp_bookings", JSON.stringify([]));
  }
  bookings = JSON.parse(localStorage.getItem("mp_bookings"));
}

// --- DOM CACHE & SETUP ---
document.addEventListener("DOMContentLoaded", () => {
  initData();
  setupUI();
  renderPublicRooms("all");
  renderPublicGallery();
  checkHashRoute();
});

// Admin visibility toggles
function showAdminEntryPoints() {
  const elNavAdmin = document.getElementById("nav-admin-link-wrapper");
  const elFooterAdmin = document.getElementById("footer-admin-link-wrapper");
  const elFloatingAdmin = document.getElementById("floating-admin-btn");
  
  if (elNavAdmin) elNavAdmin.style.display = "block";
  if (elFooterAdmin) elFooterAdmin.style.display = "block";
  if (elFloatingAdmin) elFloatingAdmin.style.display = "flex";
}

function hideAdminEntryPoints() {
  const elNavAdmin = document.getElementById("nav-admin-link-wrapper");
  const elFooterAdmin = document.getElementById("footer-admin-link-wrapper");
  const elFloatingAdmin = document.getElementById("floating-admin-btn");
  
  if (elNavAdmin) elNavAdmin.style.display = "none";
  if (elFooterAdmin) elFooterAdmin.style.display = "none";
  if (elFloatingAdmin) elFloatingAdmin.style.display = "none";
}

function lockAdminDevice() {
  if (confirm("Are you sure you want to lock and hide the Admin access on this device? You will need the secret trigger to show it again.")) {
    localStorage.removeItem("admin_access_enabled");
    sessionStorage.removeItem("admin_authenticated");
    hideAdminEntryPoints();
    showToast("Admin access has been locked and hidden on this device.", "info");
    window.location.hash = "";
    checkHashRoute();
  }
}

// Cache DOM elements
let elNavbar, elNavList, elMobileToggle, elHero, elHotelNameTexts, elContactPhone, elContactWhatsapp, elContactAddress;
let elRoomsGrid, elFilterButtons, elGalleryGrid, elLightbox, elLightboxImg, elBookingModal;
let elAdminSection, elPublicSections, elAdminTabs, elAdminPanes;
let elBookingForm, elAdminLoginForm, elAdminLoginSection, elAdminDashboardSection;
let elAdminRoomTableBody, elAdminGalleryGrid;

function setupUI() {
  // Check URL query parameters for secret unlock
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("admin") === "true") {
    localStorage.setItem("admin_access_enabled", "true");
    // Show entry points immediately
    setTimeout(() => {
      showAdminEntryPoints();
      showToast("Secret unlocked: Admin access enabled on this device!", "success");
    }, 100);
    // Remove query parameter from address bar to keep it clean/secret
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
    window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
  }

  // Secret Click Logo to Unlock Admin Panel (5 clicks within 3 seconds)
  const elLogo = document.querySelector(".logo");
  let logoClicks = 0;
  let logoClickTimeout;
  if (elLogo) {
    elLogo.addEventListener("click", () => {
      logoClicks++;
      clearTimeout(logoClickTimeout);
      
      if (logoClicks >= 5) {
        localStorage.setItem("admin_access_enabled", "true");
        showAdminEntryPoints();
        showToast("Secret unlocked: Admin access enabled on this device!", "success");
        logoClicks = 0;
        setTimeout(() => {
          window.location.hash = "#admin";
        }, 1000);
      } else {
        logoClickTimeout = setTimeout(() => {
          logoClicks = 0;
        }, 3000);
      }
    });
  }

  // Navigation & Branding
  elNavbar = document.querySelector("header");
  elMobileToggle = document.getElementById("mobile-menu-toggle");
  elNavList = document.getElementById("nav-list");
  elHero = document.getElementById("hero-section");
  elHotelNameTexts = document.querySelectorAll(".hotel-name-text");
  elContactPhone = document.getElementById("contact-phone");
  elContactWhatsapp = document.getElementById("contact-whatsapp");
  elContactAddress = document.getElementById("contact-address");
  
  // Public components
  elRoomsGrid = document.getElementById("rooms-grid");
  elFilterButtons = document.querySelectorAll(".filter-btn");
  elGalleryGrid = document.getElementById("gallery-grid");
  elLightbox = document.getElementById("lightbox-modal");
  elLightboxImg = document.getElementById("lightbox-image");
  elBookingModal = document.getElementById("booking-modal");
  elBookingForm = document.getElementById("booking-form");

  // Admin section elements
  elAdminSection = document.getElementById("admin-panel-section");
  elPublicSections = document.querySelectorAll(".public-section");
  elAdminLoginForm = document.getElementById("admin-login-form");
  elAdminLoginSection = document.getElementById("admin-login-container");
  elAdminDashboardSection = document.getElementById("admin-dashboard-container");
  elAdminTabs = document.querySelectorAll(".admin-tab-btn");
  elAdminPanes = document.querySelectorAll(".admin-pane");
  elAdminRoomTableBody = document.getElementById("admin-room-table-body");
  elAdminGalleryGrid = document.getElementById("admin-gallery-grid");

  // Apply Settings to Dynamic Elements
  updateHotelSettingsInDOM();

  // Scroll Header Effect
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      elNavbar.classList.add("scrolled");
    } else {
      elNavbar.classList.remove("scrolled");
    }
  });

  // Mobile Menu Toggle
  elMobileToggle.addEventListener("click", () => {
    elNavList.classList.toggle("active");
  });

  // Close mobile menu on nav click
  elNavList.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      elNavList.classList.remove("active");
    });
  });

  // Room Filter Buttons
  elFilterButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      elFilterButtons.forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      const filterType = e.target.getAttribute("data-filter");
      renderPublicRooms(filterType);
    });
  });

  // Close Modals
  document.querySelectorAll(".modal-close").forEach(closeBtn => {
    closeBtn.addEventListener("click", () => {
      closeAllModals();
    });
  });

  // Close Modals on Outer Click
  window.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal")) {
      closeAllModals();
    }
  });

  // Booking Form Submit
  elBookingForm.addEventListener("submit", handleBookingSubmit);

  // Admin Login Form Submit
  elAdminLoginForm.addEventListener("submit", handleAdminLogin);

  // Admin Panel Setup (Tabs)
  elAdminTabs.forEach(tab => {
    tab.addEventListener("click", (e) => {
      const targetPaneId = e.target.getAttribute("data-tab");
      elAdminTabs.forEach(t => t.classList.remove("active"));
      elAdminPanes.forEach(p => p.classList.remove("active"));

      e.target.classList.add("active");
      document.getElementById(targetPaneId).classList.add("active");
    });
  });

  // Admin Settings Forms
  document.getElementById("admin-settings-form").addEventListener("submit", handleSaveSettings);
  document.getElementById("admin-transfer-form").addEventListener("submit", handleAdminTransfer);
  document.getElementById("admin-room-form").addEventListener("submit", handleRoomSave);

  // Image Upload Handling
  const uploadZone = document.getElementById("gallery-upload-zone");
  const fileInput = document.getElementById("gallery-file-input");

  uploadZone.addEventListener("click", () => fileInput.click());
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = "var(--primary)";
  });
  uploadZone.addEventListener("dragleave", () => {
    uploadZone.style.borderColor = "var(--border-color)";
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = "var(--border-color)";
    if (e.dataTransfer.files.length > 0) {
      handleGalleryUpload(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleGalleryUpload(e.target.files[0]);
    }
  });

  // Route hash changes
  window.addEventListener("hashchange", checkHashRoute);
}

// --- DYNAMIC RENDERING (PUBLIC) ---

function updateHotelSettingsInDOM() {
  // Title / Brand Names
  elHotelNameTexts.forEach(el => {
    el.innerHTML = `${settings.name.split(" ")[0]} <span>${settings.name.split(" ").slice(1).join(" ")}</span>`;
  });
  
  // Footer contact info
  document.getElementById("footer-hotel-name").innerText = settings.name;
  document.getElementById("footer-address").innerText = settings.address;
  document.getElementById("footer-phone").innerText = settings.phone;
  document.getElementById("footer-phone").href = `tel:${settings.phone}`;
  document.getElementById("footer-whatsapp").innerText = settings.whatsapp;
  document.getElementById("footer-whatsapp").href = `https://wa.me/91${settings.whatsapp}`;

  // Contact section values
  elContactPhone.innerText = settings.phone;
  elContactPhone.href = `tel:${settings.phone}`;
  elContactWhatsapp.innerText = settings.whatsapp;
  elContactWhatsapp.href = `https://wa.me/91${settings.whatsapp}`;
  elContactAddress.innerText = settings.address;

  // Hero background set
  if (elHero) {
    elHero.style.backgroundImage = `url('${gallery[0] || DEFAULT_GALLERY[0]}')`;
  }
  
  // Set about section main photo
  const aboutImg = document.getElementById("about-main-image");
  if (aboutImg) {
    aboutImg.src = gallery[1] || DEFAULT_GALLERY[1];
  }
}

function renderPublicRooms(filterType) {
  elRoomsGrid.innerHTML = "";
  const filteredRooms = filterType === "all" ? rooms : rooms.filter(r => r.type === filterType);

  if (filteredRooms.length === 0) {
    elRoomsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem 0;">
        <p style="font-size: 1.2rem;">No rooms available under this category at the moment.</p>
      </div>
    `;
    return;
  }

  filteredRooms.forEach(room => {
    const card = document.createElement("div");
    card.className = "room-card";

    // Format badge text
    const badgeText = room.type === "ac" ? "Premium AC" : room.type === "non-ac" ? "Comfort Non-AC" : "Budget Fan Room";

    // Amenities tags
    const amenitiesHTML = room.amenities.map(a => `<span class="amenity-tag">${a}</span>`).join("");

    card.innerHTML = `
      <div class="room-img-container">
        <img src="${room.image}" alt="${room.name}" onerror="this.src='assets/images/room_ac.jpg'">
        <span class="room-badge">${badgeText}</span>
      </div>
      <div class="room-content">
        <h3 class="room-title">${room.name}</h3>
        <div class="room-price">₹${room.price} <span>/ night</span></div>
        <p class="room-desc">${room.description}</p>
        <div class="room-amenities">
          ${amenitiesHTML}
        </div>
        <div class="room-actions">
          <a href="#" class="btn-book-now" onclick="openBookingModal('${room.id}', event)">Book Now</a>
          <a href="https://wa.me/91${settings.whatsapp}?text=${encodeURIComponent('Hello, I am interested in booking ' + room.name + ' at Madhusudanam Palace. Please let me know the availability.')}" target="_blank" class="btn-whatsapp">
            <i class="fab fa-whatsapp"></i> WhatsApp
          </a>
        </div>
      </div>
    `;
    elRoomsGrid.appendChild(card);
  });
}

function renderPublicGallery() {
  elGalleryGrid.innerHTML = "";
  gallery.forEach(imgSrc => {
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.addEventListener("click", () => openLightbox(imgSrc));

    item.innerHTML = `
      <img src="${imgSrc}" alt="Madhusudanam Palace Gallery" onerror="this.style.display='none'">
      <div class="gallery-overlay">
        <div class="gallery-zoom-icon">✦</div>
      </div>
    `;
    elGalleryGrid.appendChild(item);
  });
}

// --- MODAL TRIGGERS ---

function openBookingModal(roomId, event) {
  if (event) event.preventDefault();
  currentRoomIdForBooking = roomId;
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  document.getElementById("booking-room-title").innerText = room.name;
  elBookingModal.classList.add("active");
}

function openLightbox(imgSrc) {
  elLightboxImg.src = imgSrc;
  elLightbox.classList.add("active");
}

function closeAllModals() {
  elLightbox.classList.remove("active");
  elBookingModal.classList.remove("active");
  document.getElementById("admin-room-modal").classList.remove("active");
}

// Handle Booking Form Submission -> Prepares message and pushes to WhatsApp
function handleBookingSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("booking-name").value;
  const phone = document.getElementById("booking-phone").value;
  const checkin = document.getElementById("booking-checkin").value;
  const checkout = document.getElementById("booking-checkout").value;
  const guests = document.getElementById("booking-guests").value;
  const comments = document.getElementById("booking-comments").value;

  const room = rooms.find(r => r.id === currentRoomIdForBooking);
  if (!room) return;

  // Format Booking Details
  let message = `*Booking Request - ${settings.name}*\n\n`;
  message += `*Room:* ${room.name} (₹${room.price}/night)\n`;
  message += `*Guest Name:* ${name}\n`;
  message += `*Contact No:* ${phone}\n`;
  message += `*Check-in Date:* ${checkin}\n`;
  message += `*Check-out Date:* ${checkout}\n`;
  message += `*Total Guests:* ${guests}\n`;
  if (comments.trim()) {
    message += `*Special Request:* ${comments}\n`;
  }
  message += `\n_Please confirm availability for the above request._`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/91${settings.whatsapp}?text=${encodedMessage}`;

  // Log visual notification
  showToast("Booking request prepared! Redirecting to WhatsApp...", "success");

  // Track Booking Stat locally
  let statBookings = parseInt(localStorage.getItem("mp_stat_bookings") || "0");
  localStorage.setItem("mp_stat_bookings", (statBookings + 1).toString());

  // Save Booking details in the database
  const newBooking = {
    id: "b_" + Date.now(),
    roomName: room.name,
    guestName: name,
    phone: phone,
    checkin: checkin,
    checkout: checkout,
    guests: guests,
    comments: comments,
    status: "Pending",
    dateAdded: new Date().toLocaleDateString()
  };
  bookings.push(newBooking);
  localStorage.setItem("mp_bookings", JSON.stringify(bookings));

  setTimeout(() => {
    closeAllModals();
    elBookingForm.reset();
    window.open(whatsappUrl, "_blank");
  }, 1000);
}

// --- ADMIN PANEL FUNCTIONS ---

function checkHashRoute() {
  const hash = window.location.hash;
  const isAccessEnabled = localStorage.getItem("admin_access_enabled") === "true";
  
  if (hash === "#admin") {
    if (!isAccessEnabled) {
      // Redirect back to home since admin access is not unlocked on this device
      window.location.hash = "";
      return;
    }
    
    // Hide standard pages, show admin wrapper
    elPublicSections.forEach(sec => sec.style.display = "none");
    elAdminSection.style.display = "block";
    
    // Check authentication
    const isAuth = sessionStorage.getItem("admin_authenticated") === "true";
    if (isAuth) {
      elAdminLoginSection.style.display = "none";
      elAdminDashboardSection.style.display = "block";
      renderAdminDashboard();
    } else {
      elAdminLoginSection.style.display = "flex";
      elAdminDashboardSection.style.display = "none";
    }
    // Scroll to top
    window.scrollTo(0, 0);
  } else {
    // Show standard pages, hide admin wrapper
    elPublicSections.forEach(sec => sec.style.display = "");
    elAdminSection.style.display = "none";
    
    // Show or hide admin entry points based on access status
    if (isAccessEnabled) {
      showAdminEntryPoints();
    } else {
      hideAdminEntryPoints();
    }
    
    // Re-trigger layout setup if necessary
    updateHotelSettingsInDOM();
  }
}

let loginAttempts = 0;
let lockUntil = 0;

// Admin login logic
function handleAdminLogin(e) {
  e.preventDefault();
  
  if (Date.now() < lockUntil) {
    const remainingSec = Math.ceil((lockUntil - Date.now()) / 1000);
    showToast(`Too many login attempts. Locked for ${remainingSec} seconds.`, "error");
    return;
  }

  const user = document.getElementById("admin-username").value;
  const pass = document.getElementById("admin-password").value;

  if (user === adminCredentials.username && pass === adminCredentials.password) {
    sessionStorage.setItem("admin_authenticated", "true");
    loginAttempts = 0;
    elAdminLoginSection.style.display = "none";
    elAdminDashboardSection.style.display = "block";
    showToast("Logged in successfully as Administrator", "success");
    renderAdminDashboard();
    elAdminLoginForm.reset();
  } else {
    loginAttempts++;
    if (loginAttempts >= 5) {
      lockUntil = Date.now() + 30000; // Lock for 30 seconds
      showToast("Too many incorrect attempts. Login disabled for 30 seconds.", "error");
    } else {
      showToast(`Invalid credentials. Attempt ${loginAttempts} of 5.`, "error");
    }
  }
}

// Admin Logout
function adminLogout() {
  sessionStorage.removeItem("admin_authenticated");
  window.location.hash = ""; // Returns to homepage
  showToast("Administrator logged out", "info");
}

// Render administrative dashboards & data components
function renderAdminDashboard() {
  // Update stats counters
  document.getElementById("stat-total-rooms").innerText = rooms.length;
  
  const acCount = rooms.filter(r => r.type === "ac").length;
  const nonAcCount = rooms.filter(r => r.type === "non-ac").length;
  const fanCount = rooms.filter(r => r.type === "fan").length;
  document.getElementById("stat-ac-rooms").innerText = acCount;
  document.getElementById("stat-non-ac-rooms").innerText = nonAcCount;
  document.getElementById("stat-fan-rooms").innerText = fanCount;

  // Active bookings triggered (actual number of records in database)
  document.getElementById("stat-bookings-initiated").innerText = bookings.length;

  // Calculate Bookings in the Current Month (based on booking ID timestamps)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyBookingsCount = bookings.filter(b => {
    const timestamp = parseInt(b.id.split("_")[1]);
    if (isNaN(timestamp)) return false;
    const bDate = new Date(timestamp);
    return bDate.getMonth() === currentMonth && bDate.getFullYear() === currentYear;
  }).length;
  document.getElementById("stat-bookings-month").innerText = monthlyBookingsCount;

  // Fill in Settings Forms with current values
  document.getElementById("sett-name").value = settings.name;
  document.getElementById("sett-phone").value = settings.phone;
  document.getElementById("sett-whatsapp").value = settings.whatsapp;
  document.getElementById("sett-address").value = settings.address;

  // Admin Transfer username field update
  document.getElementById("trans-username").value = adminCredentials.username;

  // Render Rooms Table & Gallery Editor & Bookings
  renderAdminRoomsTable();
  renderAdminGallery();
  renderAdminBookingsTable();
}

function renderAdminRoomsTable() {
  elAdminRoomTableBody.innerHTML = "";
  rooms.forEach(room => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${room.image}" alt="room image" onerror="this.src='assets/images/room_ac.jpg'"></td>
      <td><strong>${room.name}</strong></td>
      <td style="text-transform: uppercase;">${room.type}</td>
      <td>₹${room.price}</td>
      <td>
        <div class="admin-actions-cell">
          <button class="btn-sm btn-edit" onclick="openRoomEditModal('${room.id}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-sm btn-delete" onclick="handleRoomDelete('${room.id}')"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </td>
    `;
    elAdminRoomTableBody.appendChild(tr);
  });
}

function renderAdminGallery() {
  elAdminGalleryGrid.innerHTML = "";
  gallery.forEach((imgSrc, index) => {
    const item = document.createElement("div");
    item.className = "admin-gallery-item";
    
    // Check if it is a seeded image or an uploaded Base64 string
    const sourceLabel = imgSrc.startsWith("data:") ? "User Upload" : "System Asset";

    item.innerHTML = `
      <img src="${imgSrc}" alt="Gallery item" onerror="this.style.display='none'">
      <div class="admin-gallery-info">
        <span>${sourceLabel}</span>
        <button class="btn-sm btn-delete" onclick="handleGalleryDelete(${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;
    elAdminGalleryGrid.appendChild(item);
  });
}

// --- ADMIN CRUD OPERATIONS ---

// Delete photo
function handleGalleryDelete(index) {
  if (confirm("Are you sure you want to delete this photo from the gallery?")) {
    gallery.splice(index, 1);
    localStorage.setItem("mp_gallery", JSON.stringify(gallery));
    renderAdminGallery();
    renderPublicGallery();
    showToast("Photo deleted from gallery", "success");
  }
}

// Add/Save Settings
function handleSaveSettings(e) {
  e.preventDefault();
  settings.name = document.getElementById("sett-name").value;
  settings.phone = document.getElementById("sett-phone").value;
  settings.whatsapp = document.getElementById("sett-whatsapp").value;
  settings.address = document.getElementById("sett-address").value;

  localStorage.setItem("mp_settings", JSON.stringify(settings));
  updateHotelSettingsInDOM();
  showToast("Hotel configuration updated successfully", "success");
}

// Admin Transfer (Update master login credentials)
function handleAdminTransfer(e) {
  e.preventDefault();
  const currentPasswordVal = document.getElementById("trans-current-password").value;
  const newUsernameVal = document.getElementById("trans-username").value;
  const newPasswordVal = document.getElementById("trans-new-password").value;

  // Validate current password
  if (currentPasswordVal !== adminCredentials.password) {
    showToast("Current password validation failed. Update rejected.", "error");
    return;
  }

  // Email format validation (admin transfer ke time email ke saath transfer ho)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newUsernameVal)) {
    showToast("Please enter a valid email address as the new Admin username.", "error");
    return;
  }

  if (confirm("WARNING: You are about to transfer the Administrator account to " + newUsernameVal + ". You will be logged out. Continue?")) {
    adminCredentials.username = newUsernameVal;
    if (newPasswordVal.trim() !== "") {
      adminCredentials.password = newPasswordVal;
    }
    localStorage.setItem("mp_credentials", JSON.stringify(adminCredentials));
    document.getElementById("trans-current-password").value = "";
    document.getElementById("trans-new-password").value = "";
    showToast("Administrative credentials transferred successfully", "success");
    
    // Automatically log out user to enforce new login credentials
    setTimeout(() => {
      adminLogout();
    }, 1500);
  }
}

// Photo Uploader via Base64 conversion
function handleGalleryUpload(file) {
  if (!file.type.match("image.*")) {
    showToast("Please upload image files only.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const base64String = event.target.result;
    gallery.push(base64String);
    localStorage.setItem("mp_gallery", JSON.stringify(gallery));
    renderAdminGallery();
    renderPublicGallery();
    showToast("Photo uploaded and added to live gallery", "success");
  };
  reader.readAsDataURL(file);
}

// Room Management Open Modals
function openAddRoomModal() {
  currentRoomIdForEditing = null;
  document.getElementById("room-modal-title").innerText = "Add New Room Listing";
  document.getElementById("admin-room-form").reset();
  
  // Hide image preview for fresh entry
  document.getElementById("room-img-preview-box").style.display = "none";
  document.getElementById("room-img-preview-tag").src = "";
  
  document.getElementById("admin-room-modal").classList.add("active");
}

function openRoomEditModal(roomId) {
  currentRoomIdForEditing = roomId;
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  document.getElementById("room-modal-title").innerText = "Edit Room Details";
  document.getElementById("room-name").value = room.name;
  document.getElementById("room-type").value = room.type;
  document.getElementById("room-price").value = room.price;
  document.getElementById("room-description").value = room.description;
  document.getElementById("room-amenities").value = room.amenities.join(", ");
  
  // Set current image in preview box
  if (room.image) {
    document.getElementById("room-img-preview-tag").src = room.image;
    document.getElementById("room-img-preview-box").style.display = "block";
  } else {
    document.getElementById("room-img-preview-box").style.display = "none";
    document.getElementById("room-img-preview-tag").src = "";
  }
  
  document.getElementById("admin-room-modal").classList.add("active");
}

// Room Save (Create / Update)
function handleRoomSave(e) {
  e.preventDefault();

  const nameVal = document.getElementById("room-name").value;
  const typeVal = document.getElementById("room-type").value;
  const priceVal = parseInt(document.getElementById("room-price").value);
  const descVal = document.getElementById("room-description").value;
  const amenitiesVal = document.getElementById("room-amenities").value
    .split(",")
    .map(a => a.trim())
    .filter(a => a !== "");

  const imageInput = document.getElementById("room-image-file");

  const saveRoomDetails = (imgUrl) => {
    if (currentRoomIdForEditing) {
      // Update existing
      const rIndex = rooms.findIndex(r => r.id === currentRoomIdForEditing);
      if (rIndex !== -1) {
        rooms[rIndex].name = nameVal;
        rooms[rIndex].type = typeVal;
        rooms[rIndex].price = priceVal;
        rooms[rIndex].description = descVal;
        rooms[rIndex].amenities = amenitiesVal;
        if (imgUrl) rooms[rIndex].image = imgUrl;
      }
      showToast("Room listing updated", "success");
    } else {
      // Create new
      const newRoom = {
        id: "room_" + Date.now(),
        name: nameVal,
        type: typeVal,
        price: priceVal,
        description: descVal,
        image: imgUrl || "assets/images/room_ac.jpg",
        amenities: amenitiesVal
      };
      rooms.push(newRoom);
      showToast("New room listing added", "success");
    }

    localStorage.setItem("mp_rooms", JSON.stringify(rooms));
    renderAdminRoomsTable();
    renderPublicRooms("all");
    closeAllModals();
  };

  // Check if image file was uploaded
  if (imageInput.files && imageInput.files[0]) {
    const file = imageInput.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      saveRoomDetails(event.target.result);
    };
    reader.readAsDataURL(file);
  } else {
    // Use default or keep old image
    let existingImg = null;
    if (currentRoomIdForEditing) {
      const room = rooms.find(r => r.id === currentRoomIdForEditing);
      if (room) existingImg = room.image;
    }
    saveRoomDetails(existingImg);
  }
}

// Delete room listing
function handleRoomDelete(roomId) {
  if (confirm("Are you sure you want to delete this room listing? This action cannot be undone.")) {
    rooms = rooms.filter(r => r.id !== roomId);
    localStorage.setItem("mp_rooms", JSON.stringify(rooms));
    renderAdminRoomsTable();
    renderPublicRooms("all");
    showToast("Room listing deleted", "success");
  }
}

// --- UTILITIES ---

function showToast(message, type = "info") {
  const toast = document.getElementById("toast-notification");
  toast.innerText = message;
  toast.className = `toast toast-${type} active`;

  setTimeout(() => {
    toast.classList.remove("active");
  }, 4000);
}

// --- BOOKINGS LOG MANAGEMENT FUNCTIONS ---

function renderAdminBookingsTable() {
  const tableBody = document.getElementById("admin-bookings-table-body");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  if (bookings.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 2rem 0;">No guest bookings logged yet.</td></tr>`;
    return;
  }

  // Render in reverse chronological order (newest first)
  const sortedBookings = [...bookings].reverse();

  sortedBookings.forEach(book => {
    const tr = document.createElement("tr");
    
    // Status Badge
    let statusClass = "badge-pending";
    if (book.status === "Confirmed") statusClass = "badge-confirmed";
    if (book.status === "Cancelled") statusClass = "badge-cancelled";
    
    const badgeHTML = `<span class="badge ${statusClass}">${book.status}</span>`;

    // Actions Buttons
    let actionsHTML = "";
    if (book.status === "Pending") {
      actionsHTML = `
        <button class="btn-sm btn-edit" style="background:#25d366;" onclick="updateBookingStatus('${book.id}', 'Confirmed')"><i class="fas fa-check"></i> Confirm</button>
        <button class="btn-sm btn-delete" onclick="updateBookingStatus('${book.id}', 'Cancelled')"><i class="fas fa-times"></i> Cancel</button>
      `;
    } else {
      actionsHTML = `
        <button class="btn-sm btn-delete" style="background:var(--bg-tertiary);" onclick="deleteBookingRecord('${book.id}')"><i class="fas fa-trash-alt"></i> Delete</button>
      `;
    }

    tr.innerHTML = `
      <td>${book.dateAdded || "N/A"}</td>
      <td><strong>${book.guestName}</strong></td>
      <td>
        <div style="font-size:0.9rem;"><i class="fas fa-phone-alt" style="font-size:0.8rem; color:var(--primary); margin-right:4px;"></i> <a href="tel:${book.phone}">${book.phone}</a></div>
        <div style="font-size:0.9rem; margin-top:2px;"><i class="fab fa-whatsapp" style="font-size:0.8rem; color:#25d366; margin-right:4px;"></i> <a href="https://wa.me/91${book.phone}" target="_blank" style="color:#25d366; font-weight:600;">Chat on WA</a></div>
      </td>
      <td>${book.roomName}</td>
      <td><span style="font-size:0.85rem;">${book.checkin}</span><br>to<br><span style="font-size:0.85rem;">${book.checkout}</span></td>
      <td>${badgeHTML}</td>
      <td>
        <div class="admin-actions-cell">
          ${actionsHTML}
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function updateBookingStatus(bookingId, newStatus) {
  const bIndex = bookings.findIndex(b => b.id === bookingId);
  if (bIndex !== -1) {
    bookings[bIndex].status = newStatus;
    localStorage.setItem("mp_bookings", JSON.stringify(bookings));
    renderAdminBookingsTable();
    showToast(`Booking status set to ${newStatus}`, "success");
  }
}

function deleteBookingRecord(bookingId) {
  if (confirm("Are you sure you want to delete this booking log record?")) {
    bookings = bookings.filter(b => b.id !== bookingId);
    localStorage.setItem("mp_bookings", JSON.stringify(bookings));
    renderAdminBookingsTable();
    showToast("Booking log record deleted", "success");
  }
}

function clearAllBookings() {
  if (confirm("WARNING: Are you sure you want to permanently delete all booking records from the dashboard?")) {
    bookings = [];
    localStorage.setItem("mp_bookings", JSON.stringify([]));
    renderAdminBookingsTable();
    showToast("All booking logs cleared", "success");
  }
}

function previewRoomImage(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById("room-img-preview-tag").src = e.target.result;
      document.getElementById("room-img-preview-box").style.display = "block";
    };
    reader.readAsDataURL(input.files[0]);
  }
}
