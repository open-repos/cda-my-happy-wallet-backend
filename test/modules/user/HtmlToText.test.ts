import assert from "assert";
import { htmlToText } from "../../../src/modules/user/mail/htmlToText";

function runHtmlToTextTests() {
  const link = "https://api.example.test/v1/users/verify/42/a.b-c_d";
  const text = htmlToText(`Bonjour Ada Lovelace !
            <br/>
            Merci pour votre inscription
            <br/><br/>
            Pour vérifier votre compte, cliquez sur le lien suivant :
            <a href="${link}">Lien de confirmation (expire dans 5min)</a>
            <br/><br/>
            Bonne journée !`);

  assert.strictEqual(
    text,
    [
      "Bonjour Ada Lovelace !",
      "Merci pour votre inscription",
      "",
      "Pour vérifier votre compte, cliquez sur le lien suivant : Lien de confirmation (expire dans 5min)",
      link,
      "",
      "Bonne journée !",
    ].join("\n")
  );
  assert.strictEqual(/[<>]/.test(text), false);

  assert.strictEqual(
    htmlToText(
      "<p>A &amp; B &lt;tag&gt; &quot;c&quot; &#39;d&#39;&nbsp;e</p><p>Fin</p>"
    ),
    "A & B <tag> \"c\" 'd' e\n\nFin"
  );
  assert.strictEqual(
    htmlToText(
      '<a href="https://x.test/?a=1&amp;b=2">https://x.test/?a=1&amp;b=2</a>'
    ),
    "https://x.test/?a=1&b=2"
  );
  assert.strictEqual(htmlToText("Voir <b>ceci</b>"), "Voir ceci");
  assert.strictEqual(
    htmlToText('<a href="https://x.test/?c=&amp;amp;">Lien</a>'),
    "Lien\nhttps://x.test/?c=&amp;"
  );
  assert.strictEqual(
    htmlToText("<p>Un</p><br><br><br><p>Deux</p>"),
    "Un\n\nDeux"
  );
}

runHtmlToTextTests();
