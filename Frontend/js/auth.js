(function () {
    "use strict";

    const SESSION_KEY = "biasharaExpressAuthSession";
    const API_SETTING_KEY = "biasharaExpressApiBaseUrl";

    function getApiBaseUrl() {
        const configured = localStorage.getItem(API_SETTING_KEY);

        if (configured && configured.trim()) {
            return configured.trim().replace(/\/+$/, "");
        }

        const platform = window.Capacitor?.getPlatform?.();

        if (platform === "android") {
            return "https://biasharaexpress-backend.onrender.com";
        }

        return "https://biasharaexpress-backend.onrender.com";
    }

    function getSession() {
        try {
            const session = JSON.parse(
                localStorage.getItem(SESSION_KEY) || "null"
            );

            if (
                !session ||
                typeof session.token !== "string" ||
                !session.token ||
                typeof session.account?.id !== "string" ||
                !session.account.id
            ) {
                return null;
            }

            return session;
        } catch {
            return null;
        }
    }

    function saveSession(response) {
        if (
            !response ||
            typeof response.token !== "string" ||
            !response.token ||
            typeof response.account?.id !== "string" ||
            !response.account.id
        ) {
            throw new Error("The server returned an invalid authentication response.");
        }

        const session = {
            token: response.token,
            expiresAt: response.expiresAt || null,
            account: response.account
        };

        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        window.dispatchEvent(new CustomEvent("biashara:session-changed"));

        return session;
    }

    async function request(path, body, authenticated) {
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };

        if (authenticated) {
            const session = getSession();

            if (!session) {
                throw new Error("Please log in to continue.");
            }

            headers.Authorization = "Bearer " + session.token;
        }

        let response;

        try {
            response = await fetch(getApiBaseUrl() + path, {
                method: "POST",
                headers,
                body: JSON.stringify(body || {})
            });
        } catch {
            throw new Error(
                "Cannot reach the server. Check that the backend is running and the API address is correct."
            );
        }

        let result = {};

        try {
            result = await response.json();
        } catch {
            // Handle non-JSON error responses below.
        }

        if (!response.ok) {
            const message =
                result.message ||
                result.error ||
                (response.status === 401
                    ? "Invalid email or password, or your session has expired."
                    : response.status === 409
                        ? "An account with this email may already exist."
                        : "Request failed (HTTP " + response.status + ").");

            throw new Error(message);
        }

        return result;
    }

    async function register(details) {
        const response = await request(
            "/api/auth/register",
            details,
            false
        );

        return saveSession(response);
    }

    async function login(email, password) {
        const response = await request(
            "/api/auth/login",
            { email, password },
            false
        );

        return saveSession(response);
    }

    async function validateSession() {
        const session = getSession();

        if (!session) return false;

        if (
            session.expiresAt &&
            Date.parse(session.expiresAt) <= Date.now()
        ) {
            clearSession();
            return false;
        }

        return true;
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new CustomEvent("biashara:session-changed"));
    }

    async function logout() {
        const session = getSession();

        try {
            if (session) {
                await request("/api/auth/logout", {}, true);
            }
        } finally {
            clearSession();
            const isNestedPage = /\/pages\/[^/]*$/i.test(window.location.pathname);
            window.location.replace(isNestedPage ? "../login.html" : "login.html");
        }
    }

    window.BiasharaAuth = Object.freeze({
        getApiBaseUrl,
        getSession,
        register,
        login,
        validateSession,
        logout,
        clearSession
    });
})();



