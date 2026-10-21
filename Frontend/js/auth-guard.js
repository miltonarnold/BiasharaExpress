(function () {
    "use strict";

    const isNestedPage = /\/pages\/[^/]*$/i.test(window.location.pathname);
    const loginPath = isNestedPage ? "../login.html" : "login.html";

    document.documentElement.style.visibility = "hidden";

    async function protectPage() {
        if (!window.BiasharaAuth ||
            typeof window.BiasharaAuth.validateSession !== "function") {
            window.location.replace(loginPath);
            return;
        }

        const valid = await window.BiasharaAuth.validateSession();

        if (!valid) {
            window.location.replace(loginPath);
            return;
        }

        document.documentElement.style.visibility = "";

        const logoutButton = document.getElementById("logoutDeviceButton");
        const manageButton = document.getElementById("manageDevicesButton");
        const status = document.querySelector(
            "#securityDevicesSection .settings-help[role='status']"
        );

        if (logoutButton && logoutButton.dataset.handlerAttached !== "true") {
            logoutButton.dataset.handlerAttached = "true";
            logoutButton.disabled = false;

            logoutButton.addEventListener("click", async function () {
                if (logoutButton.dataset.signingOut === "true") return;

                logoutButton.dataset.signingOut = "true";
                logoutButton.disabled = true;
                logoutButton.textContent = "Signing out...";

                try {
                    await window.BiasharaAuth.logout();
                } catch (error) {
                    console.error("Logout failed:", error);
                    delete logoutButton.dataset.signingOut;
                    logoutButton.disabled = false;
                    logoutButton.textContent = "Log Out";

                    if (status) {
                        status.textContent =
                            "Logout could not be completed. Check your connection and try again.";
                    }
                }
            });
        }

        if (manageButton && manageButton.dataset.handlerAttached !== "true") {
            manageButton.dataset.handlerAttached = "true";
            manageButton.disabled = false;

            manageButton.addEventListener("click", function () {
                if (status) {
                    status.textContent =
                        "Device management is not available yet. This button does not revoke other sessions.";
                }
            });
        }

        if (status) {
            status.textContent =
                "Your account session is active on this device. Device management is not available yet.";
        }
    }

    function startGuard() {
        protectPage().catch(function (error) {
            console.error("Authentication guard failed:", error);
            window.location.replace(loginPath);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startGuard, { once: true });
    } else {
        startGuard();
    }
})();