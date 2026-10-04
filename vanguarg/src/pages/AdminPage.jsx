import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import PropertiesCard from "../components/PropertiesCard";
import SupportChat from "../components/SupportChat";
import { api, fromProperty } from "../api";
import { localized } from "../data/properties";
import { swissPlaces } from "../data/places";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./AdminPage.css";

const ROOM_FIELDS = [
  ["living", "roomLiving"],
  ["bedroom", "roomBedroom"],
  ["kitchen", "roomKitchen"],
  ["bathroom", "roomBathroom"],
  ["wc", "roomWc"],
  ["balcony", "roomBalcony"],
];

const emptyForm = {
  title: "",
  location: "",
  price: "",
  listingType: "sale",
  status: "available",
  visibility: "public",
  rooms: "",
  living: "",
  bedroom: "",
  kitchen: "",
  bathroom: "",
  wc: "",
  balcony: "",
  area: "",
};

function roomFields(counts = {}) {
  return Object.fromEntries(
    ROOM_FIELDS.map(([type]) => [type, counts[type] ? String(counts[type]) : ""]),
  );
}

const MAX_PHOTOS = 20;

function toAdminProperty(row) {
  return {
    ...fromProperty(row),
    status: row.Status,
    images: row.ImageUrls ? String(row.ImageUrls).split("|").filter(Boolean) : [],
  };
}

const sections = [
  { id: "properties", label: "adminNavProperties" },
  { id: "services", label: "adminNavServices" },
  { id: "users", label: "adminNavUsers" },
  { id: "messages", label: "adminNavMessages" },
  { id: "issues", label: "adminNavIssues" },
];

const emptyService = { titleDe: "", titleEn: "", textDe: "", textEn: "" };

function placeFromLocation(location) {
  const place = swissPlaces.find(
    (item) => item.de === location || item.en === location,
  );
  const parent = place
    ? swissPlaces.find((item) => item.id === place.cityId)
    : null;
  const neighborhood =
    place && place.id !== place.cityId
      ? place.de.split("–").pop().trim()
      : null;

  return {
    city: parent?.de || location,
    cityId: place?.cityId || null,
    neighborhood,
    placeId: place?.id || null,
    lat: place?.lat ?? null,
    lng: place?.lng ?? null,
  };
}

export default function AdminPage() {
  const { lang, t } = useLanguage();
  usePageSeo({
    title: "Admin | Vanguard",
    description: "Verwaltung der Immobilien.",
    path: "/admin",
    noindex: true,
  });
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [role, setRole] = useState("");
  const [section, setSection] = useState("properties");
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [message, setMessage] = useState("");
  const photoInput = useRef(null);

  const isAdmin = role === "admin";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setRole("");
      return;
    }

    let ignore = false;
    getToken()
      .then((token) => api("/api/me", { token }))
      .then((me) => {
        if (!ignore) setRole(me.role);
      })
      .catch((error) => {
        if (!ignore) setMessage(error.message);
      });

    return () => {
      ignore = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isAdmin || section === "messages") return;

    let ignore = false;
    getToken()
      .then(async (token) => {
        if (section === "properties") {
          const rows = await api("/api/properties/manage", { token });
          if (!ignore) setItems(rows.map(toAdminProperty));
        } else if (section === "users") {
          const rows = await api("/api/users", { token });
          if (!ignore) setUsers(rows);
        } else if (section === "issues") {
          const rows = await api("/api/issues", { token });
          if (!ignore) setIssues(rows);
        } else if (section === "services") {
          const rows = await api("/api/services", { token });
          if (!ignore) setServiceItems(rows);
        }
      })
      .catch((error) => {
        if (!ignore) setMessage(error.message);
      });

    return () => {
      ignore = true;
    };
  }, [isAdmin, section, getToken]);

  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  function clearPhotos() {
    setPhotos([]);
    setExistingPhotos([]);
    if (photoInput.current) photoInput.current.value = "";
  }

  function openSection(id) {
    setSection(id);
    setMessage("");
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    clearPhotos();
  }

  function addPhotos(fileList) {
    const incoming = Array.from(fileList || []);
    if (photoInput.current) photoInput.current.value = "";
    if (!incoming.length) return;

    const accepted = incoming.filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
    if (!accepted.length) {
      setMessage(t("photosFailed"));
      return;
    }
    setMessage("");
    setPhotos((current) => [...current, ...accepted].slice(0, MAX_PHOTOS));
  }

  function removePhoto(index) {
    setPhotos((current) => current.filter((_, i) => i !== index));
  }

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    clearPhotos();
  }

  async function startEdit(property) {
    setEditingId(property.id);
    setShowForm(true);
    setForm({
      title: localized(property.title, lang),
      location: property.location,
      price: String(property.price),
      listingType: property.listingType,
      status: property.status || "available",
      visibility: property.visibility || "public",
      rooms: property.rooms ? String(property.rooms) : "",
      ...roomFields(property.roomCounts),
      area: String(property.area ?? ""),
    });
    setMessage("");
    clearPhotos();
    setExistingPhotos((property.images || []).map((url, index) => ({ Id: `${url}-${index}`, Url: url })));
    if (property.visibility === "private") return;
    try {
      const detail = await api(`/api/properties/${property.id}`);
      const counts = Object.fromEntries(
        (detail.rooms || []).map((room) => [room.RoomType, room.Quantity]),
      );
      setForm((current) => ({
        ...current,
        status: detail.Status || current.status,
        visibility: detail.Visibility || current.visibility,
        ...roomFields(counts),
      }));
      setExistingPhotos(detail.images || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
    clearPhotos();
  }

  async function refresh(token) {
    const rows = await api("/api/properties/manage", { token });
    setItems(rows.map(toAdminProperty));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    const place = placeFromLocation(form.location);
    const roomCounts = ROOM_FIELDS
      .map(([type]) => ({ type, count: Number(form[type]) }))
      .filter((room) => room.count > 0);
    const body = {
      title: form.title,
      price: Number(form.price),
      ...place,
      rooms: form.rooms ? Number(form.rooms) : null,
      areaM2: Number(form.area),
      listingType: form.listingType,
      status: form.status,
      visibility: form.visibility,
      roomCounts,
    };

    try {
      const token = await getToken();
      const saved = await api(editingId ? `/api/properties/${editingId}` : "/api/properties", {
        method: editingId ? "PUT" : "POST",
        token,
        body,
      });
      setEditingId(saved.id);
      if (photos.length) {
        const data = new FormData();
        photos.forEach((file) => data.append("images", file));
        await api(`/api/properties/${saved.id}/images`, { method: "POST", token, form: data });
      }
      cancelEdit();
      await refresh(token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(t("confirmDelete"))) return;
    setMessage("");
    try {
      const token = await getToken();
      await api(`/api/properties/${id}`, { method: "DELETE", token });
      if (editingId === id) cancelEdit();
      await refresh(token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeIssueStatus(id, status) {
    setMessage("");
    try {
      const token = await getToken();
      await api(`/api/issues/${id}/status`, { method: "PATCH", token, body: { status } });
      const rows = await api("/api/issues", { token });
      setIssues(rows);
    } catch (error) {
      setMessage(error.message);
    }
  }

  const roleLabel = {
    admin: t("roleAdmin"),
    client: t("roleClient"),
    owner: t("roleOwner"),
  };

  const statusLabel = {
    available: t("statusAvailable"),
    sold: t("statusSold"),
    rented: t("statusRented"),
    new: t("statusNew"),
    in_progress: t("statusProgress"),
    resolved: t("statusResolved"),
  };

  function updateService(index, field, value) {
    setServiceItems((current) => current.map((item, i) => (
      i === index ? { ...item, [field]: value } : item
    )));
  }

  async function saveServices(event) {
    event.preventDefault();
    setMessage("");
    try {
      const token = await getToken();
      const saved = await api("/api/services", {
        token,
        method: "PUT",
        body: { items: serviceItems },
      });
      setServiceItems(saved);
      setMessage(t("servicesSaved"));
    } catch (error) {
      setMessage(error.message);
    }
  }

  const titles = {
    properties: t("adminNavProperties"),
    services: t("adminNavServices"),
    users: t("adminUsersTitle"),
    messages: t("adminMessagesTitle"),
    issues: t("adminIssuesTitle"),
  };

  return (
    <section className="section admin">
      <div className="section-head">
        <div>
          <p className="eyebrow">{t("navAdmin")}</p>
          <h1>{t("adminTitle")}</h1>
        </div>
      </div>

      {!isLoaded ? <p>{t("loading")}</p> : null}

      {isLoaded && !isSignedIn ? (
        <p className="admin-message">
          {t("signInToAdd")} <Link to="/hyr">{t("navLogin")}</Link>
        </p>
      ) : null}

      {isLoaded && isSignedIn && role && !isAdmin ? (
        <p className="admin-message">{t("adminOnly")}</p>
      ) : null}

      {isAdmin ? (
        <div className="admin-shell">
          <aside className="admin-sidebar">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? "active" : ""}
                onClick={() => openSection(item.id)}
              >
                {t(item.label)}
              </button>
            ))}
          </aside>

          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>{titles[section]}</h2>
              {section === "properties" ? (
                <button type="button" className="admin-add" onClick={startAdd}>
                  {t("addNew")}
                </button>
              ) : null}
              {section === "services" ? (
                <button
                  type="button"
                  className="admin-add"
                  onClick={() => setServiceItems((current) => [...current, emptyService])}
                >
                  {t("addNew")}
                </button>
              ) : null}
            </div>

            {section === "properties" && showForm ? (
              <form className="admin-form" onSubmit={handleSubmit}>
                <label>
                  {t("fieldTitle")}
                  <input name="title" value={form.title} onChange={updateField} required />
                </label>
                <label>
                  {t("fieldLocation")}
                  <input
                    name="location"
                    value={form.location}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  {t("fieldPrice")}
                  <input
                    name="price"
                    type="number"
                    min="1"
                    value={form.price}
                    onChange={updateField}
                    required
                  />
                </label>
                <label>
                  {t("fieldListing")}
                  <select name="listingType" value={form.listingType} onChange={updateField}>
                    <option value="sale">{t("listingSale")}</option>
                    <option value="rent">{t("listingRent")}</option>
                  </select>
                </label>
                <label>
                  {t("fieldStatus")}
                  <select name="status" value={form.status} onChange={updateField}>
                    <option value="available">{t("statusAvailable")}</option>
                    <option value="rented">{t("statusRented")}</option>
                    <option value="sold">{t("statusSold")}</option>
                  </select>
                </label>
                <label>
                  {t("fieldVisibility")}
                  <select name="visibility" value={form.visibility} onChange={updateField}>
                    <option value="public">{t("visibilityPublic")}</option>
                    <option value="private">{t("visibilityPrivate")}</option>
                  </select>
                </label>
                <label>
                  {t("fieldRooms")}
                  <input
                    name="rooms"
                    type="number"
                    min="1"
                    value={form.rooms}
                    onChange={updateField}
                  />
                </label>
                <label>
                  {t("fieldArea")}
                  <input
                    name="area"
                    type="number"
                    min="1"
                    value={form.area}
                    onChange={updateField}
                    required
                  />
                </label>
                <div className="admin-rooms">
                  <span>{t("roomsHint")}</span>
                  <div className="admin-rooms-grid">
                    {ROOM_FIELDS.map(([type, label]) => (
                      <label key={type}>
                        {t(label)}
                        <input
                          name={type}
                          type="number"
                          min="1"
                          value={form[type]}
                          onChange={updateField}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="admin-photos">
                  <span className="admin-photos-label">{t("fieldPhotos")}</span>
                  <div className={`photo-board${existingPhotos.length || previews.length ? " has-photos" : ""}`}>
                    {existingPhotos.map((photo) => (
                      <div className="photo-slot" key={photo.Id}>
                        <img src={photo.Url} alt="" />
                      </div>
                    ))}
                    {previews.map((url, index) => (
                      <div className="photo-slot" key={url}>
                        <img src={url} alt="" />
                        <button
                          type="button"
                          className="photo-remove"
                          onClick={() => removePhoto(index)}
                          aria-label={t("deleteProperty")}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="photo-slot photo-slot-add"
                      onClick={() => photoInput.current?.click()}
                      aria-label={t("fieldPhotos")}
                    >
                      <span className="photo-add">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </button>
                    <input
                      ref={photoInput}
                      className="photo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) => addPhotos(event.target.files)}
                    />
                  </div>
                  <span>{t("photosHint")}</span>
                </div>
                <div className="admin-actions">
                  <button type="submit">
                    {editingId ? t("saveProperty") : t("addProperty")}
                  </button>
                  <button type="button" className="ghost" onClick={cancelEdit}>
                    {t("cancelEdit")}
                  </button>
                </div>
              </form>
            ) : null}

            {message ? <p className="admin-message">{message}</p> : null}

            {section === "properties" ? (
              items.length ? (
                <div className="property-grid">
                  {items.map((property) => (
                    <div key={property.id}>
                      <PropertiesCard property={property} />
                      {property.images?.length > 1 ? (
                        <div className="admin-photo-strip">
                          {property.images.map((url) => (
                            <img key={url} src={url} alt="" />
                          ))}
                        </div>
                      ) : null}
                      <p className="admin-status">
                        {statusLabel[property.status] || property.status}
                        {" · "}
                        {property.visibility === "private" ? t("visibilityPrivate") : t("visibilityPublic")}
                      </p>
                      <div className="admin-card-actions">
                        <button type="button" onClick={() => startEdit(property)}>
                          {t("editProperty")}
                        </button>
                        <button type="button" className="danger" onClick={() => handleDelete(property.id)}>
                          {t("deleteProperty")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="admin-message">{t("adminEmpty")}</p>
              )
            ) : null}

            {section === "services" ? (
              <form className="service-editor" onSubmit={saveServices}>
                {serviceItems.map((item, index) => (
                  <article key={item.id || `new-${index}`}>
                    <label>
                      {t("fieldTitleDe")}
                      <input
                        value={item.titleDe}
                        onChange={(event) => updateService(index, "titleDe", event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {t("fieldTitleEn")}
                      <input
                        value={item.titleEn}
                        onChange={(event) => updateService(index, "titleEn", event.target.value)}
                      />
                    </label>
                    <label>
                      {t("fieldTextDe")}
                      <textarea
                        value={item.textDe}
                        onChange={(event) => updateService(index, "textDe", event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      {t("fieldTextEn")}
                      <textarea
                        value={item.textEn}
                        onChange={(event) => updateService(index, "textEn", event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setServiceItems((current) => current.filter((_, i) => i !== index))}
                    >
                      {t("deleteProperty")}
                    </button>
                  </article>
                ))}
                <div className="service-editor-actions">
                  <button type="submit">{t("saveProperty")}</button>
                </div>
              </form>
            ) : null}

            {section === "users" ? (
              users.length ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("name")}</th>
                      <th>{t("email")}</th>
                      <th>{t("userRole")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.Id}>
                        <td>{user.FullName || "–"}</td>
                        <td>{user.Email || "–"}</td>
                        <td>{roleLabel[user.Role] || user.Role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="admin-message">{t("adminEmpty")}</p>
              )
            ) : null}

            {section === "messages" ? <SupportChat embedded /> : null}

            {section === "issues" ? (
              issues.length ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{t("fieldTitle")}</th>
                      <th>{t("name")}</th>
                      <th>{t("issueStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((item) => (
                      <tr key={item.Id}>
                        <td>
                          <strong>{item.PropertyTitle}</strong>
                          <span>{item.Description}</span>
                        </td>
                        <td>{item.ClientName || "–"}</td>
                        <td>
                          <select
                            value={item.Status}
                            onChange={(event) => changeIssueStatus(item.Id, event.target.value)}
                          >
                            <option value="new">{t("statusNew")}</option>
                            <option value="in_progress">{t("statusProgress")}</option>
                            <option value="resolved">{t("statusResolved")}</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="admin-message">{t("adminEmpty")}</p>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {message && !isAdmin ? <p className="admin-message">{message}</p> : null}
    </section>
  );
}
