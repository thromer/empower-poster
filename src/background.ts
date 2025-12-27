import browser from "webextension-polyfill";
import { getClassifications, getHoldings } from "./processing";
import type { Classifications, HoldingEntry } from "./processing";
import type {
  PostDataRequest,
  PostDataResponse,
  TokenRequest,
  TokenResponse,
} from "./types";
import { getPostUrl } from "./util";

interface PostPayload {
  version: string;
  holdings: HoldingEntry[];
  classifications: Classifications;
}

console.log(`Background script started at ${new Date()}`);

browser.runtime.onInstalled.addListener(async (details) => {
  console.log(`Extension installed at ${new Date()}`, details);
  if (!(await getPostUrl())) {
    browser.tabs.create({ url: "src/onboarding.html" });
  }
});

let csrf = "";

browser.webRequest.onBeforeRequest.addListener(
  (details: browser.WebRequest.OnBeforeRequestDetailsType) => {
    const csrfVal = details?.requestBody?.formData?.["csrf"]?.[0];
    if (csrfVal && csrfVal !== csrf) {
      csrf = csrfVal;
      console.log("Saved token");
    }
    return {};
  },
  {
    urls: ["https://pc-api.empower-retirement.com/*"],
    types: ["xmlhttprequest"],
  },
  ["requestBody"],
);

// Listen for post data message from content script
browser.runtime.onMessage.addListener(
  (message: TokenRequest | PostDataRequest) => {
    // TODO: try catch, and return a response either way.
    if (message.type === "POST_DATA_REQUEST") {
      const request = message as PostDataRequest;
      return postData(request.data);
    }
    if (message.type === "TOKEN_REQUEST") {
      const response: TokenResponse = { csrf };
      return Promise.resolve(response);
    }
    return;
  },
);

async function postData(
  data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<PostDataResponse> {
  try {
    const postUrl = await getPostUrl();
    if (!postUrl) {
      throw new Error("POST URL not configured, can't post data");
    }
    if (!data.spData) {
      console.log(`data=${JSON.stringify(data)}`);
      throw new Error("spData missing from JSON data, nothing to POST");
    }
    const classificationsIn = data.spData.classifications[0].classifications;
    const holdings = getHoldings(data.spData.holdings);
    const classifications = getClassifications(classificationsIn);
    const payload: PostPayload = { version: "0.2", holdings, classifications };
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    };
    const r = await fetch(postUrl, options);
    if (r.ok) {
      return { ok: true };
    }
    const contentType = r.headers.get("content-type");
    let detail: string;
    try {
      if (contentType?.includes("application/json")) {
        const json = await r.json();
        detail = json.message || json.error || JSON.stringify(json);
      } else {
        detail = await r.text();
      }
    } catch {
      detail = r.statusText;
    }
    return { ok: false, message: `${r.status} ${detail}` };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : JSON.stringify(e),
    };
  }
}
