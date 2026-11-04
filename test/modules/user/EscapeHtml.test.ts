import assert from "assert";
import { escapeHtml } from "../../../src/modules/user/mail/escapeHtml";

assert.strictEqual(
  escapeHtml(`<a href="x">Tom & Jerry's</a>`),
  "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;"
);
assert.strictEqual(escapeHtml("Élodie"), "Élodie");
