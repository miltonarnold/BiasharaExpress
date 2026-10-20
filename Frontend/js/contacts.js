(() => {
    "use strict";

    const type = document.body.dataset.contactType;
    if (!["customers", "suppliers"].includes(type)) {
        throw new Error("Invalid contact page type.");
    }

    const KEY = type === "customers"
        ? "biasharaExpressCustomers"
        : "biasharaExpressSuppliers";

    const singular = type === "customers" ? "customer" : "supplier";
    const $ = id => document.getElementById(id);
    let contacts = [];
    let databaseReady = false;
    let saving = false;

    function loadContacts() {
        try {
            const value = JSON.parse(localStorage.getItem(KEY) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    }

    function notify(message, error = false) {
        $("contactMessage").textContent = message;
        $("contactMessage").style.color = error ? "var(--loss)" : "var(--text-secondary)";
    }

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;",
            '"': "&quot;", "'": "&#39;"
        })[character]);
    }

    function render() {
        const query = $("contactSearch").value.trim().toLowerCase();
        const filtered = contacts.filter(contact =>
            [contact.name, contact.phone, contact.location, contact.notes]
                .some(value => String(value || "").toLowerCase().includes(query))
        );

        $("contactCount").textContent =
            `${filtered.length} of ${contacts.length} contact(s)`;

        if (!filtered.length) {
            $("contactRows").innerHTML =
                '<tr><td colspan="5">No matching contacts found.</td></tr>';
            return;
        }

        $("contactRows").innerHTML = filtered.map(contact => `
            <tr>
                <td>${escapeHtml(contact.name)}</td>
                <td>${escapeHtml(contact.phone || "—")}</td>
                <td>${escapeHtml(contact.location || "—")}</td>
                <td>${escapeHtml(contact.notes || "—")}</td>
                <td>
                    <button type="button" class="contact-row-action"
                        data-action="edit" data-id="${escapeHtml(contact.id)}">Edit</button>
                    <button type="button" class="contact-row-action contact-delete"
                        data-action="delete" data-id="${escapeHtml(contact.id)}">Delete</button>
                </td>
            </tr>`).join("");
    }

    function resetForm() {
        $("contactForm").reset();
        $("contactEditId").value = "";
        $("contactFormTitle").textContent = `Register ${singular}`;
        $("contactSaveButton").textContent = `Save ${singular}`;
        $("contactCancelButton").hidden = true;
    }

    async function persistContacts(nextContacts) {
        if (!databaseReady || !window.BiasharaSQLite) {
            throw new Error("Local database is not ready.");
        }

        const previous = localStorage.getItem(KEY);

        try {
            localStorage.setItem(KEY, JSON.stringify(nextContacts));
            await window.BiasharaSQLite.put(KEY, nextContacts, {
                sync: true,
                entity: type,
                recordId: KEY
            });
            contacts = nextContacts;
        } catch (error) {
            if (previous === null) localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, previous);
            throw error;
        }
    }

    $("contactForm").addEventListener("submit", async event => {
        event.preventDefault();
        if (saving || !databaseReady) {
            notify("Please wait for the local database to become ready.", true);
            return;
        }

        const name = $("contactName").value.trim();
        if (!name) {
            notify("Enter a name before saving.", true);
            return;
        }

        saving = true;
        $("contactSaveButton").disabled = true;

        try {
            const editId = $("contactEditId").value;
            const oldContact = contacts.find(contact => String(contact.id) === editId);
            const now = new Date().toISOString();

            const entry = {
                id: oldContact ? oldContact.id :
                    `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name,
                phone: $("contactPhone").value.trim(),
                location: $("contactLocation").value.trim(),
                notes: $("contactNotes").value.trim(),
                createdAt: oldContact?.createdAt || now,
                updatedAt: now
            };

            const next = oldContact
                ? contacts.map(contact => String(contact.id) === editId ? entry : contact)
                : [...contacts, entry];

            await persistContacts(next);
            resetForm();
            render();
            notify(`${singular[0].toUpperCase() + singular.slice(1)} saved locally.`);
        } catch (error) {
            console.error("Contact save failed:", error);
            notify("Could not save the contact. Your previous records were preserved.", true);
        } finally {
            saving = false;
            $("contactSaveButton").disabled = false;
        }
    });

    $("contactRows").addEventListener("click", async event => {
        const button = event.target.closest("button[data-action]");
        if (!button || saving) return;

        const contact = contacts.find(item => String(item.id) === button.dataset.id);
        if (!contact) return;

        if (button.dataset.action === "edit") {
            $("contactEditId").value = contact.id;
            $("contactName").value = contact.name || "";
            $("contactPhone").value = contact.phone || "";
            $("contactLocation").value = contact.location || "";
            $("contactNotes").value = contact.notes || "";
            $("contactFormTitle").textContent = `Edit ${singular}`;
            $("contactSaveButton").textContent = `Update ${singular}`;
            $("contactCancelButton").hidden = false;
            $("contactName").focus();
            return;
        }

        if (!window.confirm(`Delete ${singular} "${contact.name}" from this contact register?`)) {
            return;
        }

        saving = true;
        try {
            await persistContacts(contacts.filter(item => String(item.id) !== String(contact.id)));
            if ($("contactEditId").value === String(contact.id)) resetForm();
            render();
            notify(`${singular[0].toUpperCase() + singular.slice(1)} deleted from this contact register.`);
        } catch (error) {
            console.error("Contact delete failed:", error);
            notify("Could not delete the contact. Your previous records were preserved.", true);
        } finally {
            saving = false;
        }
    });

    $("contactCancelButton").addEventListener("click", resetForm);
    $("contactSearch").addEventListener("input", render);

    async function initialize() {
        try {
            const db = window.BiasharaSQLite;
            if (!db) throw new Error("SQLite adapter is unavailable.");

            await db.init();
            contacts = loadContacts();

            await db.put(KEY, contacts, {
                sync: false,
                entity: type,
                recordId: KEY
            });

            databaseReady = true;
            render();
            notify("Local database ready. Contacts are saved on this device.");
        } catch (error) {
            console.error("Contact database initialization failed:", error);
            notify("Local database could not initialize. Saving is disabled to protect your records.", true);
        }
    }

    initialize();
})();
