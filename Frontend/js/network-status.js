(function () {
    "use strict";

    function updateNetworkStatus() {
        var online = navigator.onLine;
        var sidebarStatus = document.querySelector(".connection-status");
        var sidebarText = sidebarStatus
            ? sidebarStatus.querySelector("strong")
            : null;
        var indicator = sidebarStatus
            ? sidebarStatus.querySelector(".status-indicator")
            : null;
        var mobileStatus = document.querySelector(".brand-mark-mobile p");
        var mobileDot = mobileStatus
            ? mobileStatus.querySelector(".online-dot")
            : null;

        if (sidebarText) {
            sidebarText.textContent = online ? "Online" : "Offline";
        }

        if (sidebarStatus) {
            sidebarStatus.classList.toggle("network-online", online);
            sidebarStatus.classList.toggle("network-offline", !online);
            sidebarStatus.setAttribute(
                "aria-label",
                online ? "Network status: Online" : "Network status: Offline"
            );
        }

        if (indicator) {
            indicator.setAttribute("aria-hidden", "true");
        }

        if (mobileStatus) {
            mobileStatus.lastChild.textContent = online ? " Online" : " Offline";
        }

        if (mobileDot) {
            mobileDot.classList.toggle("network-dot-online", online);
            mobileDot.classList.toggle("network-dot-offline", !online);
        }
    }

    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
    document.addEventListener("DOMContentLoaded", updateNetworkStatus);

    updateNetworkStatus();
})();
