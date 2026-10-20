"use strict";

(() => {
    const STORAGE_KEY = "biasharaExpressIdentity";

    document.addEventListener("DOMContentLoaded", () => {
        const profileButton = document.getElementById("profileButton");
        const heading = document.getElementById("welcomeHeading");

        if (!profileButton || !heading) {
            console.error("Business identity: dashboard elements were not found.");
            return;
        }

        let identity = null;

        try {
            identity = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        } catch {
            identity = null;
        }

        const modal = document.createElement("div");
        modal.id = "businessIdentityModal";
        modal.className = "identity-overlay";
        modal.hidden = true;

        modal.innerHTML = `
            <section class="identity-card" role="dialog"
                aria-modal="true" aria-labelledby="identityTitle">
                <div class="identity-mark">BE</div>
                <h2 id="identityTitle">Personalise your business</h2>
                <p>Choose what you want to see when you open BiasharaExpress.</p>
                <form id="businessIdentityForm">
                    <label for="identityType">Display preference</label>
                    <select id="identityType" required>
                        <option value="business">Business name</option>
                        <option value="owner">My name</option>
                    </select>
                    <label for="identityName" id="identityNameLabel">Business name</label>
                    <input id="identityName" type="text" maxlength="60"
                        placeholder="Enter your business name" required>
                    <button type="submit" class="identity-save">Save and continue</button>
                    <button type="button" id="identityCancel" class="identity-cancel">
                        Cancel
                    </button>
                </form>
            </section>
        `;

        document.body.appendChild(modal);

        const form = modal.querySelector("#businessIdentityForm");
        const typeInput = modal.querySelector("#identityType");
        const nameInput = modal.querySelector("#identityName");
        const nameLabel = modal.querySelector("#identityNameLabel");
        const cancelButton = modal.querySelector("#identityCancel");

        function render(data) {
            const displayName = data.name.trim();
            const profileName = profileButton.querySelector(".profile-details strong");
            const avatar = profileButton.querySelector(".profile-avatar");
            const subtitle = document.getElementById("welcomeSubtitle");

            heading.textContent = displayName;

            if (profileName) profileName.textContent = displayName;
            if (avatar) avatar.textContent = displayName.charAt(0).toUpperCase();

            if (subtitle) {
                subtitle.textContent = "Track your business performance today.";
            }

            document.title = `${displayName} | BiasharaExpress`;
        }

        function openEditor() {
            const current = identity || { type: "business", name: "" };

            typeInput.value = current.type;
            nameInput.value = current.name;
            updateLabel();
            cancelButton.hidden = !identity;
            modal.hidden = false;
            nameInput.focus();
        }

        function updateLabel() {
            const isBusiness = typeInput.value === "business";
            nameLabel.textContent = isBusiness ? "Business name" : "Your name";
            nameInput.placeholder = isBusiness
                ? "Enter your business name"
                : "Enter your name";
        }

        typeInput.addEventListener("change", updateLabel);

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = nameInput.value.trim();

            if (!name) {
                nameInput.focus();
                return;
            }

            identity = { type: typeInput.value, name };

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
            } catch (error) {
                alert("Could not save the name on this device. Please check device storage.");
                console.error(error);
                return;
            }

            render(identity);
            modal.hidden = true;
        });

        cancelButton.addEventListener("click", () => {
            modal.hidden = true;
        });

        profileButton.addEventListener("click", openEditor);

        const openSettings = new URLSearchParams(window.location.search).get("settings") === "1";

        if (identity && typeof identity.name === "string" && identity.name.trim()) {
            render(identity);
        } else if (!openSettings) {
            openEditor();
        }
    });
})();



