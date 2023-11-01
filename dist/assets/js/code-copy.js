(function (window) {
  "use strict";

  if (!document.queryCommandSupported("copy")) {
    return;
  }

  function flashCopyMessage(el, msg) {
    el.textContent = msg;
    setTimeout(function () {
      el.innerHTML = "📋<span>Copy</span>";
    }, 1000);
  }

  function selectText(node) {
    var selection = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
  }

  function addCopyButton(containerEl) {
    if (containerEl.classList && containerEl.classList.contains('has-copy-btn')) {
      return; // Exit if the button is already added
    }

    var copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.innerHTML = "📋<span>Copy</span>";
    var codeEl = containerEl.firstElementChild;
    copyBtn.addEventListener("click", function () {
      try {
        var selection = selectText(codeEl);
        document.execCommand("copy");
        selection.removeAllRanges();
        flashCopyMessage(copyBtn, "Copied!");
      } catch (e) {
        console && console.log(e);
        flashCopyMessage(copyBtn, "Failed");
      }
    });
    containerEl.appendChild(copyBtn);
    containerEl.classList.add('has-copy-btn');
  }

  // Expose the addCopyButton function to the global scope
  window.addCopyButton = addCopyButton;

})(window);
