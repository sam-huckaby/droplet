import { clearCookie } from "../crypto/cookies";
import { escapeHtml, htmlPage } from "./layout";
import { webauthnScript } from "./scripts";
import type { AppUsageSummary, AuditEventRecord, PasskeyRecord, PasskeyUsageSummary } from "../types";

export function adminLoginPage(allowBootstrap: boolean): Response {
  return htmlPage(
    "Passkey Gate Admin",
    `<section class="panel">
      <h1>Admin</h1>
      <p>Sign in with an admin passkey.</p>
      <button id="admin-passkey">Use admin passkey</button>
      ${allowBootstrap ? `<hr><form method="post" action="/api/admin/bootstrap-login"><label>Bootstrap password <input type="password" name="password" autocomplete="current-password" required></label><button type="submit">Use bootstrap password</button></form>` : ""}
    </section>
    ${webauthnScript}
    <script>
    document.getElementById('admin-passkey').addEventListener('click', async () => {
      const start = await fetch('/api/admin/passkey/options', { method: 'POST' }).then(r => r.json());
      if (!start.ok) throw new Error(start.error || 'Unable to start passkey login');
      const credential = await navigator.credentials.get(requestOptionsFromJSON(start.options));
      const verify = await fetch('/api/admin/passkey/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challengeId: start.challengeId, response: publicKeyCredentialToJSON(credential) }) });
      if (verify.ok) location.href = '/admin'; else alert('Unable to verify passkey');
    });
    </script>`,
  );
}

export function bootstrapAdminPage(): Response {
  return htmlPage(
    "Bootstrap Admin",
    `<section class="panel">
      <h1>Bootstrap recovery</h1>
      <p>You are signed in with the bootstrap password. Create your first admin passkey, then set <code>ALLOW_BOOTSTRAP_PW=false</code>.</p>
      <p>If you already enrolled your admin passkey, log out of bootstrap recovery and sign back in with your passkey.</p>
      <form method="post" action="/api/admin/bootstrap-enrollment-link"><button type="submit">Create and open first admin enrollment link</button></form>
      <form method="post" action="/api/admin/logout"><button type="submit">Log out of bootstrap recovery</button></form>
    </section>`,
  );
}

export function adminDashboard(passkeys: PasskeyRecord[], audit: AuditEventRecord[], usage: { passkeys: PasskeyUsageSummary[]; apps: AppUsageSummary[] }, createdLink?: string): Response {
  const rows = passkeys
    .map(
      (passkey) => `<tr>
        <td><input data-passkey-label="${escapeHtml(passkey.id)}" value="${escapeHtml(passkey.label)}"></td>
        <td><input data-passkey-email="${escapeHtml(passkey.id)}" type="email" value="${escapeHtml(passkey.email)}"></td>
        <td>${passkey.isAdmin ? "yes" : "no"}</td>
        <td>${escapeHtml(passkey.createdAt)}</td><td>${escapeHtml(passkey.lastUsedAt ?? "never")}</td><td>${passkey.revokedAt ? "revoked" : "active"}</td>
        <td><button data-passkey-save="${escapeHtml(passkey.id)}" type="button">Save</button><form method="post" action="/api/admin/passkeys/${encodeURIComponent(passkey.id)}/revoke"><button type="submit">Revoke</button></form></td>
      </tr>`,
    )
    .join("");
  const auditRows = audit
    .map((event) => `<tr><td>${escapeHtml(event.createdAt)}</td><td>${escapeHtml(event.eventType)}</td><td>${escapeHtml(event.appId ?? "")}</td><td>${escapeHtml(event.email ?? "")}</td></tr>`)
    .join("");
  const passkeyUsageRows = usage.passkeys
    .map((item) => `<tr><td>${escapeHtml(item.passkeyId)}</td><td>${escapeHtml(item.email ?? "")}</td><td>${escapeHtml(item.appId)}</td><td>${item.totalLogins}</td><td>${escapeHtml(item.lastLoginAt)}</td></tr>`)
    .join("");
  const appUsageRows = usage.apps
    .map((item) => `<tr><td>${escapeHtml(item.appId)}</td><td>${item.totalLogins}</td><td>${item.uniquePasskeys}</td><td>${escapeHtml(item.lastLoginAt)}</td></tr>`)
    .join("");

  return htmlPage(
    "Passkey Gate Admin",
    `<section>
      <h1>Passkey Gate</h1>
      ${createdLink ? `<div class="panel"><h2>Enrollment link</h2><p>This raw link is shown once.</p><p><a href="${escapeHtml(createdLink)}">${escapeHtml(createdLink)}</a></p></div>` : ""}
      <form method="post" action="/api/admin/logout"><button type="submit">Log out</button></form>
      <div class="panel"><h2>Create enrollment link</h2><form method="post" action="/api/admin/enrollment-links">
        <label>Email <input name="defaultEmail" type="email"></label>
        <label>Label <input name="defaultLabel"></label>
        <label><input name="createsAdminPasskey" type="checkbox" value="true"> Admin passkey?</label>
        <button type="submit">Create enrollment link</button>
      </form></div>
      <h2>Passkeys</h2><table><thead><tr><th>Label</th><th>Email</th><th>Admin?</th><th>Created</th><th>Last used</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>Passkey usage by app</h2><table><thead><tr><th>Passkey</th><th>Email</th><th>App</th><th>Total logins</th><th>Last login</th></tr></thead><tbody>${passkeyUsageRows}</tbody></table>
      <h2>App usage</h2><table><thead><tr><th>App</th><th>Total logins</th><th>Unique passkeys</th><th>Last login</th></tr></thead><tbody>${appUsageRows}</tbody></table>
      <h2>Recent audit</h2><table><thead><tr><th>Time</th><th>Event</th><th>App</th><th>Email</th></tr></thead><tbody>${auditRows}</tbody></table>
    </section>
    <script>
    for (const button of document.querySelectorAll('[data-passkey-save]')) {
      button.addEventListener('click', async () => {
        const id = button.getAttribute('data-passkey-save');
        const email = document.querySelector('[data-passkey-email="' + CSS.escape(id) + '"]').value;
        const label = document.querySelector('[data-passkey-label="' + CSS.escape(id) + '"]').value;
        const response = await fetch('/api/admin/passkeys/' + encodeURIComponent(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, label }) });
        if (response.ok) location.reload(); else alert('Unable to update passkey');
      });
    }
    </script>`,
  );
}

export function logoutResponse(): Response {
  const headers = new Headers({ location: "/admin" });
  headers.append("set-cookie", clearCookie("pg_admin"));
  headers.append("set-cookie", clearCookie("pg_bootstrap"));
  return new Response(null, { status: 303, headers });
}
