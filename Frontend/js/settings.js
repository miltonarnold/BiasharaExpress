
(function () {
    "use strict";

    const KEY = "biasharaExpressSettings";
    const SECURITY_KEY = "biasharaExpressSecurityPreferences";
    const IDENTITY_KEY = "biasharaExpressIdentity";

    const defaults = {
        businessName: "",
        ownerName: "",
        phone: "",
        location: "",
        language: "en",
        currency: "KSh",
        receiptFooter: "Thank you for shopping with us",
        lowStock: 5
    };

    const securityDefaults = {
        requireLoginOnReopen: true,
        autoLockMinutes: 5,
        allowMultipleDevices: true
    };

    function readObject(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key) || "null");
            return value && typeof value === "object" && !Array.isArray(value)
                ? { ...fallback, ...value }
                : { ...fallback };
        } catch (error) {
            console.error("Could not read settings:", key, error);
            return { ...fallback };
        }
    }

    function loadSettings() {
        const result = readObject(KEY, defaults);

        if (!["en", "kis"].includes(result.language)) result.language = "en";
        if (typeof result.lowStock !== "number" ||
            !Number.isFinite(result.lowStock) ||
            result.lowStock < 0) result.lowStock = defaults.lowStock;

        return result;
    }

    function setLabelText(id, value) {
        const element = document.getElementById(id);
        if (!element) return;

        // Preserve controls nested inside labels.
        const control = element.querySelector("input, select, textarea");
        if (control) {
            let textNode = [...element.childNodes].find(
                node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
            );

            if (!textNode) {
                textNode = document.createTextNode("");
                element.insertBefore(textNode, element.firstChild);
            }

            textNode.textContent = value + " ";
        } else {
            element.textContent = value;
        }
    }

    function applyLanguage(language) {
        const sw = language === "kis";
        document.documentElement.lang = sw ? "sw" : "en";

        const text = sw ? {
            heading: "Mipangilio",
            subtitle: "Weka mapendeleo ya biashara yako.",
            business: "Taarifa za Biashara",
            preferences: "Lugha na Sarafu",
            language: "Lugha ya Matumizi",
            currency: "Sarafu",
            receipt: "Mipangilio ya Risiti",
            footer: "Ujumbe wa Chini ya Risiti",
            inventory: "Arifa za Bidhaa",
            lowStock: "Kiwango cha Tahadhari ya Bidhaa Chache",
            save: "Hifadhi Mipangilio",
            saved: "Mipangilio imehifadhiwa.",
            failed: "Imeshindwa kuhifadhi mipangilio.",
            invalidStock: "Weka kiwango halali cha bidhaa chache (0 au zaidi).",
            businessName: "Jina la Biashara",
            ownerName: "Mmiliki wa Biashara",
            phone: "Nambari ya Simu",
            location: "Mahali pa Biashara"
        } : {
            heading: "Settings",
            subtitle: "Configure your business preferences.",
            business: "Business Profile",
            preferences: "Language and Currency",
            language: "Language of Use",
            currency: "Currency",
            receipt: "Receipt Settings",
            footer: "Receipt Footer Message",
            inventory: "Inventory Alerts",
            lowStock: "Default Low-Stock Warning Level",
            save: "Save Settings",
            saved: "Settings saved successfully.",
            failed: "Could not save settings. Please try again.",
            invalidStock: "Enter a valid low-stock warning level (zero or greater).",
            businessName: "Business Name",
            ownerName: "Business Owner",
            phone: "Phone Number",
            location: "Business Location"
        };

        const setText = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };

        setText("settingsHeading", text.heading);
        setText("settingsSubtitle", text.subtitle);
        setText("settingsBusinessHeading", text.business);
        setText("settingsPreferencesHeading", text.preferences);
        setText("settingsReceiptHeading", text.receipt);
        setText("settingsInventoryHeading", text.inventory);
        setText("settingsSaveButton", text.save);

        setLabelText("settingsLanguageLabel", text.language);
        setLabelText("settingsCurrencyLabel", text.currency);
        setLabelText("settingsBusinessNameLabel", text.businessName);
        setLabelText("settingsOwnerNameLabel", text.ownerName);
        setLabelText("settingsPhoneLabel", text.phone);
        setLabelText("settingsLocationLabel", text.location);
        setLabelText("settingsReceiptFooterLabel", text.footer);
        setLabelText("settingsLowStockLabel", text.lowStock);

        return text;
    }

    function renderIdentity(settings) {
        const identity = readObject(IDENTITY_KEY, { type: "business", name: "" });
        const displayName = identity.type === "owner"
            ? settings.ownerName
            : settings.businessName;

        if (!displayName || !displayName.trim()) return;

        const name = displayName.trim();
        const heading = document.getElementById("welcomeHeading");
        const profileName = document.querySelector("#profileButton .profile-details strong");
        const avatar = document.querySelector("#profileButton .profile-avatar");

        if (heading) heading.textContent = name;
        if (profileName) profileName.textContent = name;
        if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
        document.title = name + " | BiasharaExpress";
    }

    function initializeSettings() {
        const panel = document.getElementById("settingsContent");
        const dashboard = document.querySelector(".dashboard-content");
        const form = document.getElementById("settingsForm");

        if (!panel || !form) return;

        const isSettingsPage =
            document.body.classList.contains("settings-page") ||
            new URLSearchParams(location.search).get("settings") === "1";

        panel.hidden = !isSettingsPage;
        if (dashboard) dashboard.hidden = isSettingsPage;

        if (isSettingsPage) {
            document.querySelectorAll(".nav-link").forEach(link => {
                const active = link.href.includes("settings=1");
                link.classList.toggle("active", active);
                if (active) link.setAttribute("aria-current", "page");
                else link.removeAttribute("aria-current");
            });
        }

        const settings = loadSettings();
        const security = readObject(SECURITY_KEY, securityDefaults);

        const fields = {
            settingBusinessName: settings.businessName,
            settingOwnerName: settings.ownerName,
            settingPhone: settings.phone,
            settingLocation: settings.location,
            settingLanguage: settings.language,
            settingCurrency: settings.currency,
            settingReceiptFooter: settings.receiptFooter,
            settingLowStock: settings.lowStock
        };

        Object.entries(fields).forEach(([id, value]) => {
            const field = document.getElementById(id);
            if (field) field.value = String(value ?? "");
        });

        const requireLogin = document.getElementById("securityRequireLogin");
        const autoLock = document.getElementById("securityAutoLock");
        const multipleDevices = document.getElementById("securityAllowMultipleDevices");

        if (requireLogin) requireLogin.checked = security.requireLoginOnReopen !== false;
        if (autoLock) {
            autoLock.value = ["1", "5", "15", "30"].includes(String(security.autoLockMinutes))
                ? String(security.autoLockMinutes) : "5";
        }
        if (multipleDevices) multipleDevices.checked = security.allowMultipleDevices !== false;

        const languageSelector = document.getElementById("settingLanguage");
        let currentText = applyLanguage(settings.language);

        if (languageSelector) {
            languageSelector.addEventListener("change", () => {
                currentText = applyLanguage(languageSelector.value);
            });
        }

        form.addEventListener("submit", event => {
            event.preventDefault();

            const message = document.getElementById("settingsSaveMessage");
            const field = id => document.getElementById(id);

            const requiredIds = [
                "settingBusinessName", "settingOwnerName", "settingPhone",
                "settingLocation", "settingLanguage", "settingCurrency",
                "settingReceiptFooter", "settingLowStock",
                "securityRequireLogin", "securityAutoLock",
                "securityAllowMultipleDevices"
            ];

            const missing = requiredIds.filter(id => !field(id));
            if (missing.length) {
                if (message) message.textContent =
                    "Cannot save settings. Missing controls: " + missing.join(", ");
                console.error("Settings controls missing:", missing);
                return;
            }

            const lowStockRaw = field("settingLowStock").value.trim();
            const lowStock = Number(lowStockRaw);

            if (
                lowStockRaw === "" ||
                !Number.isFinite(lowStock) ||
                lowStock < 0 ||
                lowStock > 1000000 ||
                !Number.isInteger(lowStock)
            ) {
                currentText = applyLanguage(field("settingLanguage").value);
                if (message) message.textContent = currentText.invalidStock;
                field("settingLowStock").focus();
                return;
            }

            const updated = {
                businessName: field("settingBusinessName").value.trim(),
                ownerName: field("settingOwnerName").value.trim(),
                phone: field("settingPhone").value.trim(),
                location: field("settingLocation").value.trim(),
                language: field("settingLanguage").value,
                currency: field("settingCurrency").value,
                receiptFooter: field("settingReceiptFooter").value.trim(),
                lowStock
            };

            const updatedSecurity = {
                requireLoginOnReopen: requireLogin.checked,
                autoLockMinutes: Number(autoLock.value),
                allowMultipleDevices: multipleDevices.checked
            };

            if (!["en", "kis"].includes(updated.language)) {
                if (message) message.textContent = "Choose a supported language.";
                return;
            }

            if (!["1", "5", "15", "30"].includes(String(updatedSecurity.autoLockMinutes))) {
                if (message) message.textContent = "Choose a valid automatic-lock duration.";
                return;
            }

            try {
                localStorage.setItem(KEY, JSON.stringify(updated));
                localStorage.setItem(SECURITY_KEY, JSON.stringify(updatedSecurity));

                // Keep the display preference but update its name from the profile.
                const identity = readObject(IDENTITY_KEY, { type: "business", name: "" });
                const displayName = identity.type === "owner"
                    ? updated.ownerName
                    : updated.businessName;

                if (displayName) {
                    localStorage.setItem(IDENTITY_KEY, JSON.stringify({
                        type: identity.type === "owner" ? "owner" : "business",
                        name: displayName
                    }));
                }

                currentText = applyLanguage(updated.language);
                renderIdentity(updated);

                if (message) message.textContent = currentText.saved;
                console.info("Settings saved for the current account.");
            } catch (error) {
                console.error("Settings save failed:", error);
                if (message) message.textContent = currentText.failed;
            }
        });

        renderIdentity(settings);
    }

    document.addEventListener("DOMContentLoaded", initializeSettings);
})();
