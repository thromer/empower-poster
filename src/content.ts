import browser from "webextension-polyfill";
import type { PostDataRequest, PostDataResponse, TokenResponse } from "./types";

const fetchDataScript = async (csrf: string) => {
  try {
    const api_url =
      "https://pc-api.empower-retirement.com/api/invest/getHoldings";
    const body = new URLSearchParams({
      userAccountIds: "[]",
      classificationStyles: '["allocation"]',
      lastServerChangeId: "-1",
      csrf,
      apiClient: "WEB",
    }).toString();
    const options = {
      referrer: "https://ira.empower-retirement.com/",
      credentials: "include" as RequestCredentials,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    };
    const response = await fetch(api_url, options);
    const data = await response.json();
    return data;
  } catch (e) {
    const msg = `Caught exception: ${e instanceof Error ? e.message : e}`;
    console.error(msg);
    return { error: msg };
  }
};

const button = document.createElement("button");
button.textContent = "Post data";
button.style.cssText =
  "position: fixed; top: 10px; right: 10px; z-index: 10000; padding: 10px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px;";
const statusLine = document.createElement("div");

statusLine.id = "post-data-status";
statusLine.style.cssText =
  "position: fixed; top: 60px; right: 10px; z-index: 10000; padding: 5px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px; max-width: 200px;";
statusLine.textContent = "Ready";

button.onclick = async () => {
  button.disabled = true;
  statusLine.textContent = "Posting...";
  try {
    const csrf = (
      (await browser.runtime.sendMessage({
        type: "TOKEN_REQUEST",
      })) as TokenResponse
    ).csrf;
    if (!csrf) {
      throw new Error("Can't retrieve data. Not logged in?");
    }
    const resultsJson = await fetchDataScript(csrf);
    const message: PostDataRequest = {
      type: "POST_DATA_REQUEST",
      data: resultsJson,
    };
    const response = (await browser.runtime.sendMessage(
      message,
    )) as PostDataResponse;
    if (!response.ok) {
      throw new Error(
        `POST failed: ${response.message}. Do you need to configure POST destination at chrome://extensions/?options=lfjdkpiggkdkglapfjbifhgfhmilcmim ?`,
      );
    }
    statusLine.textContent = `Posted at ${new Date()}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : JSON.stringify(e);
    statusLine.textContent = msg;
    console.error(msg);
  } finally {
    button.disabled = false;
    button.textContent = "Post data";
  }
};
document.body.appendChild(button);
document.body.appendChild(statusLine);
