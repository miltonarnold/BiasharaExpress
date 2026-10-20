(() => {
    "use strict";

    const dateFieldIds = [
        "reportDate",
        "salesDate",
        "saleDate",
        "purchaseDate",
        "financeDate",
        "debtDate",
        "repaymentDate"
    ];

    function localDate() {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    }

    let lastDate = localDate();

    function initializeEmptyDates() {
        const currentDate = localDate();

        dateFieldIds.forEach(id => {
            const field = document.getElementById(id);
            if (field && !field.value) {
                field.value = currentDate;
            }
        });
    }

    function updateDates() {
        const currentDate = localDate();

        if (currentDate === lastDate) {
            initializeEmptyDates();
            return;
        }

        const previousDate = lastDate;
        lastDate = currentDate;

        dateFieldIds.forEach(id => {
            const field = document.getElementById(id);

            if (field && (!field.value || field.value === previousDate)) {
                field.value = currentDate;
                field.dispatchEvent(new Event("change", { bubbles: true }));
            }
        });

        document.dispatchEvent(new CustomEvent("biashara:date-rollover", {
            detail: { date: currentDate, previousDate }
        }));
    }

    initializeEmptyDates();
    setInterval(updateDates, 15000);
    window.addEventListener("pageshow", initializeEmptyDates);
})();
