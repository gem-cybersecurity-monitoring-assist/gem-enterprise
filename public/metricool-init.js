(function () {
  if (typeof window === "undefined") return;
  if (document.querySelector('script[data-gem-metricool="true"]')) return;

  var script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://tracker.metricool.com/resources/be.js";
  script.async = true;
  script.dataset.gemMetricool = "true";
  script.onload = function () {
    if (window.beTracker && typeof window.beTracker.t === "function") {
      window.beTracker.t({ hash: "3d19f1c1f08799a08dca4eaa5a85e91" });
    }
  };
  document.head.appendChild(script);
})();
