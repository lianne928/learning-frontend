/**
 * 🛠️ Merge 專案：全自動登入狀態監測與觀測站工具
 * 功能：自動注入 UI、解析 JWT、處理登出
 */

(function() {
  // --- 1. 定義「Token 觀測站」的 HTML 結構 (樣板字串) ---
  const debugPanelHTML = `
    <div id="dev-debug-panel" style="position: fixed; bottom: 20px; right: 20px; width: 320px; background: rgba(20, 20, 20, 0.95); border: 2px solid #00ff00; border-radius: 10px; padding: 15px; color: #00ff00; font-family: monospace; z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(5px);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #00ff00; padding-bottom: 8px; margin-bottom: 12px;">
        <strong style="font-size: 1.1em;">🛠️ Token 觀測站</strong>
        <button onclick="document.getElementById('dev-debug-panel').style.display='none'" style="background: transparent; color: #ff4444; border: 1px solid #ff4444; border-radius: 4px; cursor: pointer; padding: 2px 8px; font-weight: bold;">隱藏</button>
      </div>
      <div style="font-size: 13px; margin-bottom: 10px;">
        <div style="margin-bottom: 5px; color: #fff;">📍 <b>目前儲存的 JWT：</b></div>
        <div id="dev-token-display" style="background: #000; color: #aaa; padding: 8px; border-radius: 6px; font-size: 11px; word-break: break-all; max-height: 80px; overflow-y: auto; border: 1px solid #333;">讀取中...</div>
      </div>
      <div style="display: flex; gap: 10px; margin-top: 15px;">
        <button onclick="window.refreshDevToken()" style="flex: 1; background: #00ff00; color: #000; border: none; padding: 8px; border-radius: 5px; cursor: pointer; font-weight: bold;">重新讀取</button>
        <button onclick="window.clearDevToken()" style="flex: 1; background: #ffaa00; color: #000; border: none; padding: 8px; border-radius: 5px; cursor: pointer; font-weight: bold;">清除 (登出)</button>
      </div>
    </div>
  `;

  // --- 2. 初始化功能：網頁載入後執行 ---
  document.addEventListener("DOMContentLoaded", () => {
    // A. 注入觀測站 HTML
    document.body.insertAdjacentHTML('beforeend', debugPanelHTML);

    // C. 啟動觀測站第一次顯示
    setTimeout(window.refreshDevToken, 300);
  });

  // --- 3. 定義全域函數 (掛載到 window 以供 HTML onclick 呼叫) ---

  // 重新整理觀測站數值
  window.refreshDevToken = function() {
    const token = localStorage.getItem("jwt_token");
    const display = document.getElementById("dev-token-display");
    if (!display) return;

    if (token) {
      display.innerText = token;
      display.style.color = "#00ff00";
    } else {
      display.innerText = "❌ 尚未登入，找不到 Token";
      display.style.color = "#ff4444";
    }
  };

  // 清除 Token (模擬登出)
  window.clearDevToken = function() {
    if (confirm("確定要清除所有登入資料並重新整理嗎？")) {
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("userId");
      window.location.reload();
    }
  };

  // 標準登出
  window.logout = function() {
    if (confirm("確定要登出嗎？")) {
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("userId");
      alert("已成功登出！");
      window.location.reload();
    }
  };

})();