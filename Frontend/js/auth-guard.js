(function () {
    "use strict";

    const isNestedPage = /\/pages\/[^/]*$/i.test(window.location.pathname);
    const loginPath = isNestedPage ? "../login.html" : "login.html";

    document.documentElement.style.visibility = "hidden";

    async function protectPage() {
        const valid = await window.BiasharaAuth.validateSession();

        if (!valid) {
            window.location.replace(loginPath);
            return;
        }

        document.documentElement.style.visibility = "";

        const logoutButton = document.getElementById("logoutDeviceButton");
        if (logoutButton) {
            logoutButton.disabled = false;
            logoutButton.addEventListener("click", async function () {
                logoutButton.disabled = true;
                logoutButton.textContent = "Signing out...";
                try {
                    await window.BiasharaAuth.logout();
                } catch (error) {
                    logoutButton.disabled = false;
                    logoutButton.textContent = "Log Out";
                    const help = document.querySelector(".settings-help");
                    if (help) help.textContent =
                        "Logout could not be completed. Please check your connection and try again.";
                }
            });
        }

        const help = document.querySelector(".settings-help");
        if (help && logoutButton) {
            help.textContent = "Your account session is active on this device.";
        }
    }

    protectPage().catch(function () {
        window.location.replace(loginPath);
    });
})();
