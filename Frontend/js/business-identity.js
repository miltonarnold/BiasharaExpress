(function () {
    "use strict";

    const PHOTO_PREFIX = "biasharaExpressProfilePhoto:";

    function getAccount() {
        try {
            const session = window.BiasharaAuth?.getSession?.();
            return session && session.account ? session.account : null;
        } catch (error) {
            console.error("Unable to read account profile:", error);
            return null;
        }
    }

    function getAccountName(account) {
        if (!account) return "Account Owner";

        const first = account.firstName || account.first_name || "";
        const last = account.lastName || account.last_name || "";
        const combined = (first + " " + last).trim();

        const value =
            account.name ||
            account.fullName ||
            account.full_name ||
            account.displayName ||
            account.display_name ||
            account.ownerName ||
            account.owner_name ||
            combined ||
            account.email;

        return typeof value === "string" && value.trim()
            ? value.trim()
            : "Account Owner";
    }

    function getPhotoKey(account) {
        const identifier = account && (
            account.id ??
            account.accountId ??
            account.account_id ??
            account.email
        );

        return PHOTO_PREFIX + String(identifier || "current");
    }

    function getSavedPhoto(account) {
        try {
            return localStorage.getItem(getPhotoKey(account));
        } catch (error) {
            console.error("Unable to read saved profile picture:", error);
            return null;
        }
    }

    function renderProfile() {
        const account = getAccount();
        const name = getAccountName(account);
        const nameElement = document.getElementById("accountProfileName");
        const menuName = document.getElementById("accountMenuName");
        const avatar = document.getElementById("accountProfileAvatar");
        const photo = document.getElementById("accountProfilePhoto");
        const removeButton = document.getElementById("removeProfilePhotoButton");

        if (!nameElement || !menuName || !avatar || !photo) return;

        nameElement.textContent = name;
        menuName.textContent = name;

        const initials = name.split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("");

        avatar.textContent = initials || "U";

        const savedPhoto = getSavedPhoto(account);
        const accountPhoto = account && (
            account.profilePhotoUrl ||
            account.profile_photo_url ||
            account.avatarUrl ||
            account.avatar_url ||
            account.profilePicture ||
            account.profile_picture ||
            account.photoUrl ||
            account.photo_url ||
            account.imageUrl
        );

        const imageSource = savedPhoto ||
            (typeof accountPhoto === "string" &&
             (/^https?:\/\//i.test(accountPhoto) || /^data:image\//i.test(accountPhoto))
                ? accountPhoto
                : null);

        photo.onerror = function () {
            photo.hidden = true;
            avatar.hidden = false;
            photo.removeAttribute("src");
            if (removeButton) removeButton.hidden = !savedPhoto;
        };

        if (imageSource) {
            photo.onload = function () {
                photo.hidden = false;
                avatar.hidden = true;
            };
            photo.src = imageSource;
            if (removeButton) removeButton.hidden = !savedPhoto;
        } else {
            photo.hidden = true;
            photo.removeAttribute("src");
            avatar.hidden = false;
            if (removeButton) removeButton.hidden = true;
        }
    }

    function initialize() {
        const wrapper = document.getElementById("accountProfileWrapper");
        const profileButton = document.getElementById("profileButton");
        const menu = document.getElementById("accountProfileMenu");
        const photoInput = document.getElementById("accountProfilePhotoInput");
        const changeButton = document.getElementById("changeProfilePhotoButton");
        const removeButton = document.getElementById("removeProfilePhotoButton");
        const logoutButton = document.getElementById("dashboardLogoutButton");
        const message = document.getElementById("accountProfileMessage");

        if (!wrapper || !profileButton || !menu) return;

        function closeMenu() {
            menu.hidden = true;
            profileButton.setAttribute("aria-expanded", "false");
        }

        profileButton.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            const opening = menu.hidden;
            menu.hidden = !opening;
            profileButton.setAttribute("aria-expanded", String(opening));
        });

        function showMessage(text) {
            if (message) message.textContent = text;
        }

        menu.addEventListener("click", function (event) {
            event.stopPropagation();
        });

        document.addEventListener("click", function (event) {
            if (!wrapper.contains(event.target)) closeMenu();
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeMenu();
                profileButton.focus();
            }
        });

        changeButton.addEventListener("click", function () {
            showMessage("");
            photoInput.click();
        });

        photoInput.addEventListener("change", function () {
            const file = photoInput.files && photoInput.files[0];
            if (!file) return;

            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                showMessage("Choose a JPG, PNG or WebP image.");
                photoInput.value = "";
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                showMessage("Choose an image smaller than 5 MB.");
                photoInput.value = "";
                return;
            }

            const reader = new FileReader();

            reader.onerror = function () {
                showMessage("Could not read that image. Please try again.");
                photoInput.value = "";
            };

            reader.onload = function () {
                const image = new Image();

                image.onerror = function () {
                    showMessage("That image could not be opened.");
                    photoInput.value = "";
                };

                image.onload = function () {
                    try {
                        const canvas = document.createElement("canvas");
                        const maxSide = 320;
                        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

                        canvas.width = Math.max(1, Math.round(image.width * scale));
                        canvas.height = Math.max(1, Math.round(image.height * scale));

                        const context = canvas.getContext("2d");
                        if (!context) throw new Error("Image processing is unavailable.");

                        context.drawImage(image, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

                        localStorage.setItem(getPhotoKey(getAccount()), dataUrl);
                        renderProfile();
                        showMessage("Profile picture saved on this device.");
                    } catch (error) {
                        console.error("Unable to save profile picture:", error);
                        showMessage("Could not save the picture. Try a smaller image.");
                    } finally {
                        photoInput.value = "";
                    }
                };

                image.src = reader.result;
            };

            reader.readAsDataURL(file);
        });

        removeButton.addEventListener("click", function () {
            try {
                localStorage.removeItem(getPhotoKey(getAccount()));
                renderProfile();
                showMessage("Uploaded profile picture removed.");
            } catch (error) {
                console.error("Unable to remove profile picture:", error);
                showMessage("Could not remove the picture.");
            }
        });

        logoutButton.addEventListener("click", async function () {
            if (logoutButton.disabled) return;

            if (!window.BiasharaAuth ||
                typeof window.BiasharaAuth.logout !== "function") {
                showMessage("Logout is unavailable. Please refresh the page.");
                return;
            }

            logoutButton.disabled = true;
            logoutButton.lastChild.textContent = " Signing out...";

            try {
                await window.BiasharaAuth.logout();
            } catch (error) {
                console.error("Dashboard logout failed:", error);
                logoutButton.disabled = false;
                logoutButton.lastChild.textContent = " Log out";
                showMessage("Logout failed. Please try again.");
            }
        });

        renderProfile();
        window.addEventListener("biashara:session-changed", renderProfile);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
        initialize();
    }
})();



