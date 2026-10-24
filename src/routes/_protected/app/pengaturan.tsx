import { useEffect, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { StockDialog } from "@/components/stock-app/stock-dialog";
import {
  StockToast,
  type StockToastTone,
} from "@/components/stock-app/stock-toast";
import { siteConfig } from "@/config/site";
import { formatLongDate } from "@/lib/format";
import { getJson, patchJson, postJson, putJson } from "@/lib/http-client";
import { type StoreRecord, type UserRecord } from "@/lib/inventory-types";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_protected/app/pengaturan")({
  head: () => ({ meta: [{ title: `Pengaturan | ${siteConfig.name}` }] }),
  component: SettingsPage,
});

type Tab = "toko" | "pengguna" | "profil";
type AccessValue = "none" | "view" | "edit";

type StoreForm = {
  name: string;
  code: string;
  address: string;
  phone: string;
  active: boolean;
};

const emptyStoreForm: StoreForm = {
  name: "",
  code: "",
  address: "",
  phone: "",
  active: true,
};

function accessLabel(level: AccessValue | undefined) {
  return level === "edit"
    ? "Catat stok"
    : level === "view"
      ? "Lihat"
      : "Tidak ada";
}

function isOwner(user: UserRecord) {
  return (user.role ?? "")
    .split(",")
    .map((role) => role.trim())
    .some((role) => role === "owner" || role === "admin");
}

function isAdmin(user: UserRecord) {
  return (user.role ?? "")
    .split(",")
    .map((role) => role.trim())
    .includes("admin");
}

function SettingsPage() {
  const { session } = Route.useRouteContext();
  const router = useRouter();
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [tab, setTab] = useState<Tab>("toko");
  const [toast, setToast] = useState<{
    message: string;
    tone?: StockToastTone;
  } | null>(null);

  const [storeOpen, setStoreOpen] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState<StoreForm>(emptyStoreForm);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storePending, setStorePending] = useState(false);

  const [accessOpen, setAccessOpen] = useState(false);
  const [accessUserId, setAccessUserId] = useState<string | null>(null);
  const [accessValues, setAccessValues] = useState<Record<string, AccessValue>>(
    {},
  );
  const [accessPending, setAccessPending] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [profileName, setProfileName] = useState(session.user.name);
  const [profileEmail, setProfileEmail] = useState(session.user.email);
  const [profilePassword, setProfilePassword] = useState("");
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePending, setProfilePending] = useState(false);

  const accessUser = users.find((user) => user.id === accessUserId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    getJson<StoreRecord[]>("/api/stores", controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setStores(rows);
        setLoadError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setLoadError(
          caught instanceof Error ? caught.message : "Toko gagal dimuat.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    getJson<UserRecord[]>("/api/users", controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setUsers(rows);
        setUsersError(null);
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setUsers([]);
        setUsersError(
          caught instanceof Error
            ? caught.message
            : "Daftar pengguna hanya bisa dibuka pemilik.",
        );
      });
    return () => controller.abort();
  }, [reloadKey]);

  function showToast(message: string, tone: StockToastTone = "success") {
    setToast({ message, tone });
  }

  function openAddStore() {
    setEditingStoreId(null);
    setStoreForm(emptyStoreForm);
    setStoreError(null);
    setStoreOpen(true);
  }

  function openEditStore(store: StoreRecord) {
    setEditingStoreId(store.id);
    setStoreForm({
      name: store.name,
      code: store.code,
      address: store.address ?? "",
      phone: store.phone ?? "",
      active: store.isActive,
    });
    setStoreError(null);
    setStoreOpen(true);
  }

  async function submitStore(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (storePending) return;
    setStoreError(null);

    const name = storeForm.name.trim();
    const code = storeForm.code.trim();
    if (!name) {
      setStoreError("Nama toko wajib diisi.");
      return;
    }
    if (!code) {
      setStoreError("Kode toko wajib diisi.");
      return;
    }

    setStorePending(true);
    try {
      const payload = {
        name,
        code,
        address: storeForm.address.trim(),
        phone: storeForm.phone.trim(),
        isActive: storeForm.active,
      };
      if (editingStoreId) {
        await patchJson(`/api/stores/${editingStoreId}`, payload);
        showToast(`Toko “${name}” diperbarui.`);
      } else {
        await postJson("/api/stores", payload);
        showToast(`Toko “${name}” ditambahkan.`);
      }
      setStoreOpen(false);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setStoreError(
        caught instanceof Error ? caught.message : "Toko gagal disimpan.",
      );
    } finally {
      setStorePending(false);
    }
  }

  function openAccess(user: UserRecord) {
    if (user.id === session.user.id || isAdmin(user)) return;
    setAccessUserId(user.id);
    const values: Record<string, AccessValue> = {};
    for (const store of stores) {
      values[store.id] = user.access[store.id] ?? "none";
    }
    setAccessValues(values);
    setAccessError(null);
    setAccessOpen(true);
  }

  async function submitAccess(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessUser || accessPending) return;
    setAccessError(null);
    setAccessPending(true);
    try {
      const access = stores
        .filter((store) => (accessValues[store.id] ?? "none") !== "none")
        .map((store) => ({
          storeId: store.id,
          accessLevel: (accessValues[store.id] ?? "view") as "view" | "edit",
        }));
      await putJson(`/api/users/${accessUser.id}/access`, { access });
      showToast(`Akses ${accessUser.name} diperbarui.`);
      setAccessOpen(false);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      setAccessError(
        caught instanceof Error ? caught.message : "Akses gagal disimpan.",
      );
    } finally {
      setAccessPending(false);
    }
  }

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profilePending) return;
    setProfileError(null);

    const name = profileName.trim();
    const email = profileEmail.trim();

    if (!name) {
      setProfileError("Nama wajib diisi.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setProfileError("Masukkan alamat email yang valid.");
      return;
    }
    if (profilePassword && profilePassword.length < 8) {
      setProfileError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (profilePassword && !profileCurrentPassword) {
      setProfileError("Isi kata sandi saat ini untuk mengganti kata sandi.");
      return;
    }

    setProfilePending(true);
    try {
      if (name !== session.user.name || email !== session.user.email) {
        await patchJson("/api/profile", { name, email });
      }
      if (profilePassword) {
        const result = await authClient.changePassword({
          currentPassword: profileCurrentPassword,
          newPassword: profilePassword,
          revokeOtherSessions: true,
        });
        if (result.error)
          throw new Error(
            result.error.message ?? "Kata sandi gagal diperbarui.",
          );
      }
      setProfilePassword("");
      setProfileCurrentPassword("");
      showToast("Profil disimpan.");
      void router.invalidate();
    } catch (caught) {
      setProfileError(
        caught instanceof Error ? caught.message : "Profil gagal disimpan.",
      );
    } finally {
      setProfilePending(false);
    }
  }

  function accessChips(user: UserRecord) {
    if (isOwner(user))
      return (
        <span className="settings-access-chip">Semua toko · Catat stok</span>
      );

    const entries = stores
      .map((store) => ({ store, level: user.access[store.id] }))
      .filter((entry) => entry.level);
    if (entries.length === 0)
      return <span className="ss-meta">Belum ada akses</span>;

    return entries.map(({ store, level }) => (
      <span key={store.id} className="settings-access-chip">
        {store.name} · {accessLabel(level)}
      </span>
    ));
  }

  return (
    <div className="settings-page">
      <header className="ss-page-head">
        <div>
          <p className="ss-date">{formatLongDate(new Date().toISOString())}</p>
          <h1 className="ss-title">Pengaturan</h1>
          <p className="ss-subtitle">
            Kelola data toko, akses pengguna, dan profil akun.
          </p>
        </div>
      </header>

      <div className="settings-tabs">
        <div className="ss-seg" role="group" aria-label="Bagian pengaturan">
          {(
            [
              ["toko", "Toko"],
              ["pengguna", "Pengguna"],
              ["profil", "Profil"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <p className="ss-form-error" role="alert">
          {loadError}
        </p>
      )}

      <section
        className="settings-panel"
        data-panel="toko"
        aria-label="Pengaturan toko"
        hidden={tab !== "toko"}
      >
        <div className="settings-section-head">
          <div>
            <h2 className="ss-section-title">Toko</h2>
            <p className="ss-card-desc">
              {loading ? "Memuat…" : `${stores.length} toko`}
            </p>
          </div>
          <button
            type="button"
            className="ss-btn ss-btn-primary"
            onClick={openAddStore}
          >
            <Plus aria-hidden="true" />
            Tambah toko
          </button>
        </div>
        <div className="settings-store-grid">
          {stores.map((store) => (
            <article key={store.id} className="ss-card settings-store">
              <div className="settings-store-head">
                <div>
                  <h3>{store.name}</h3>
                  <span className="ss-code">{store.code}</span>
                </div>
                <span
                  className={`ss-pill ${
                    store.isActive ? "ss-pill-success" : "ss-pill-neutral"
                  }`}
                >
                  {store.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>
              <p className="settings-store-detail">
                {store.address || "Alamat belum diisi"}
              </p>
              <p className="settings-store-detail">
                {store.phone || "Nomor telepon belum diisi"}
              </p>
              <div className="settings-store-foot">
                <button
                  type="button"
                  className="ss-btn ss-btn-outline ss-btn-sm"
                  onClick={() => openEditStore(store)}
                  aria-label={`Ubah ${store.name}`}
                >
                  Ubah
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="settings-panel"
        data-panel="pengguna"
        aria-label="Pengaturan pengguna"
        hidden={tab !== "pengguna"}
      >
        <section className="ss-card">
          <div className="ss-card-head">
            <div>
              <h2 className="ss-card-title">Pengguna &amp; akses</h2>
              <p className="ss-card-desc">
                Atur siapa yang boleh melihat atau mencatat stok di tiap toko.
              </p>
            </div>
          </div>
          {usersError ? (
            <div className="ss-empty">
              <p className="ss-empty-title" role="alert">
                {usersError}
              </p>
              <p>Hanya pemilik yang bisa mengelola akses pengguna.</p>
            </div>
          ) : (
            <>
              <div className="ss-table-wrap">
                <table className="ss-table">
                  <thead>
                    <tr>
                      <th scope="col">Pengguna</th>
                      <th scope="col">Peran</th>
                      <th scope="col">Akses toko</th>
                      <th scope="col">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <div className="settings-user-cell">
                            <p className="ss-strong">{user.name}</p>
                            <p className="ss-meta">{user.email}</p>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`ss-pill ${
                              isOwner(user) ? "ss-pill-neutral" : "ss-pill-info"
                            }`}
                          >
                            {isOwner(user) ? "Pemilik" : "Karyawan"}
                          </span>
                        </td>
                        <td>
                          <div className="settings-access-chips">
                            {accessChips(user)}
                          </div>
                        </td>
                        <td>
                          {user.id === session.user.id || isAdmin(user) ? (
                            <span className="ss-meta">
                              {isOwner(user) ? "Akses penuh" : "Akun aktif"}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="ss-btn ss-btn-ghost ss-btn-sm"
                              onClick={() => openAccess(user)}
                              aria-label={`Ubah akses ${user.name}`}
                            >
                              Ubah akses
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ss-table-hint">
                Geser tabel ke samping untuk melihat semua kolom.
              </p>
            </>
          )}
        </section>
      </section>

      <section
        className="settings-panel"
        data-panel="profil"
        aria-label="Profil akun"
        hidden={tab !== "profil"}
      >
        <section className="ss-card settings-profile">
          <div className="ss-card-head">
            <div>
              <h2 className="ss-card-title">Profil akun</h2>
              <p className="ss-card-desc">
                Perbarui nama, email, atau kata sandi akunmu.
              </p>
            </div>
          </div>
          <form className="ss-form" onSubmit={submitProfile} noValidate>
            <div className="ss-field">
              <label htmlFor="profile-name">Nama</label>
              <input
                id="profile-name"
                maxLength={120}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
              />
            </div>
            <div className="ss-field">
              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                type="email"
                maxLength={160}
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
              />
            </div>
            <div className="ss-field">
              <label htmlFor="profile-password">
                Kata sandi baru <span className="ss-optional">(opsional)</span>
              </label>
              <input
                id="profile-password"
                type="password"
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                value={profilePassword}
                onChange={(event) => setProfilePassword(event.target.value)}
              />
            </div>
            {profilePassword && (
              <div className="ss-field">
                <label htmlFor="profile-current-password">
                  Kata sandi saat ini
                </label>
                <input
                  id="profile-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={profileCurrentPassword}
                  onChange={(event) =>
                    setProfileCurrentPassword(event.target.value)
                  }
                />
                <p className="ss-hint">
                  Diperlukan untuk mengganti kata sandi.
                </p>
              </div>
            )}
            {profileError && (
              <p className="ss-form-error" role="alert">
                {profileError}
              </p>
            )}
            <div className="settings-form-actions">
              <button
                type="submit"
                className="ss-btn ss-btn-primary"
                disabled={profilePending}
              >
                {profilePending ? "Menyimpan…" : "Simpan profil"}
              </button>
            </div>
          </form>
        </section>
      </section>

      <StockDialog
        open={storeOpen}
        onClose={() => setStoreOpen(false)}
        labelledBy="store-dialog-title"
        describedBy="store-dialog-desc"
      >
        <div className="ss-dialog-inner">
          <div className="ss-dialog-head">
            <div>
              <h2 className="ss-dialog-title" id="store-dialog-title">
                {editingStoreId ? "Ubah toko" : "Tambah toko"}
              </h2>
              <p className="ss-dialog-desc" id="store-dialog-desc">
                {editingStoreId
                  ? "Perbarui data toko ini."
                  : "Isi data toko yang akan dikelola."}
              </p>
            </div>
            <button
              type="button"
              className="ss-dialog-close"
              onClick={() => setStoreOpen(false)}
              aria-label="Tutup dialog toko"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <form className="ss-form" onSubmit={submitStore} noValidate>
            <div className="ss-field">
              <label htmlFor="store-form-name">Nama toko</label>
              <input
                id="store-form-name"
                maxLength={120}
                placeholder="Contoh: Toko Pupuk"
                value={storeForm.name}
                onChange={(event) =>
                  setStoreForm((value) => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
                data-autofocus
              />
            </div>
            <div className="ss-field">
              <label htmlFor="store-form-code">Kode toko</label>
              <input
                id="store-form-code"
                maxLength={20}
                placeholder="PPK"
                value={storeForm.code}
                onChange={(event) =>
                  setStoreForm((value) => ({
                    ...value,
                    code: event.target.value,
                  }))
                }
              />
            </div>
            <div className="ss-field">
              <label htmlFor="store-form-address">
                Alamat <span className="ss-optional">(opsional)</span>
              </label>
              <input
                id="store-form-address"
                maxLength={200}
                placeholder="Alamat toko"
                value={storeForm.address}
                onChange={(event) =>
                  setStoreForm((value) => ({
                    ...value,
                    address: event.target.value,
                  }))
                }
              />
            </div>
            <div className="ss-field">
              <label htmlFor="store-form-phone">
                Telepon <span className="ss-optional">(opsional)</span>
              </label>
              <input
                id="store-form-phone"
                maxLength={30}
                placeholder="0812-0000-0000"
                value={storeForm.phone}
                onChange={(event) =>
                  setStoreForm((value) => ({
                    ...value,
                    phone: event.target.value,
                  }))
                }
              />
            </div>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={storeForm.active}
                onChange={(event) =>
                  setStoreForm((value) => ({
                    ...value,
                    active: event.target.checked,
                  }))
                }
              />
              Toko aktif
            </label>
            {storeError && (
              <p className="ss-form-error" role="alert">
                {storeError}
              </p>
            )}
            <div className="ss-dialog-actions">
              <button
                type="button"
                className="ss-btn ss-btn-outline"
                onClick={() => setStoreOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="ss-btn ss-btn-primary"
                disabled={storePending}
              >
                {storePending
                  ? "Menyimpan…"
                  : editingStoreId
                    ? "Simpan perubahan"
                    : "Simpan toko"}
              </button>
            </div>
          </form>
        </div>
      </StockDialog>

      <StockDialog
        open={accessOpen}
        onClose={() => setAccessOpen(false)}
        labelledBy="access-dialog-title"
        describedBy="access-dialog-desc"
      >
        <div className="ss-dialog-inner">
          <div className="ss-dialog-head">
            <div>
              <h2 className="ss-dialog-title" id="access-dialog-title">
                Ubah akses
              </h2>
              <p className="ss-dialog-desc" id="access-dialog-desc">
                Atur akses {accessUser?.name ?? "pengguna"} ke tiap toko.
              </p>
            </div>
            <button
              type="button"
              className="ss-dialog-close"
              onClick={() => setAccessOpen(false)}
              aria-label="Tutup dialog akses"
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <form className="ss-form" onSubmit={submitAccess} noValidate>
            <div className="settings-access-list">
              {stores.map((store) => (
                <div key={store.id} className="settings-access-row">
                  <label htmlFor={`access-${store.id}`}>{store.name}</label>
                  <select
                    id={`access-${store.id}`}
                    value={accessValues[store.id] ?? "none"}
                    onChange={(event) =>
                      setAccessValues((value) => ({
                        ...value,
                        [store.id]: event.target.value as AccessValue,
                      }))
                    }
                  >
                    <option value="none">Tidak ada</option>
                    <option value="view">Lihat</option>
                    <option value="edit">Catat stok</option>
                  </select>
                </div>
              ))}
            </div>
            {accessError && (
              <p className="ss-form-error" role="alert">
                {accessError}
              </p>
            )}
            <div className="ss-dialog-actions">
              <button
                type="button"
                className="ss-btn ss-btn-outline"
                onClick={() => setAccessOpen(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="ss-btn ss-btn-primary"
                disabled={accessPending}
              >
                {accessPending ? "Menyimpan…" : "Simpan akses"}
              </button>
            </div>
          </form>
        </div>
      </StockDialog>

      <StockToast
        message={toast?.message ?? null}
        tone={toast?.tone}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
