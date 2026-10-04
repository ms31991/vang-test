import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import PropertiesCard from "../components/PropertiesCard";
import SupportChat from "../components/SupportChat";
import { api, fromProperty } from "../api";
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

const MAX_PHOTOS = 20;

function toAdminProperty(row) {
  return {
    ...fromProperty(row),
    status: row.Status,
    images: row.ImageUrls
      ? String(row.ImageUrls).split("|").filter(Boolean)
      : [],
  };
}

const sections = [
  { id: "properties", label: "adminNavProperties" },
  { id: "services", label: "adminNavServices" },
  { id: "users", label: "adminNavUsers" },
  { id: "messages", label: "adminNavMessages" },
];

const emptyService = {
  titleDe: "",
  titleEn: "",
  textDe: "",
  textEn: "",
};

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
  const { t } = useLanguage();

  usePageSeo({
    title: `${t("navAdmin")} | Vanguard`,
    description: t("adminSeo"),
    path: "/verwaltung",
    noindex: true,
  });

  const navigate = useNavigate();

  const {
    isLoaded,
    isSignedIn,
    getToken,
  } = useAuth();

  const [section, setSection] = useState("properties");
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [serviceItems, setServiceItems] = useState([]);

  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState([]);

  const [message, setMessage] = useState("");

  const photoInput = useRef(null);

  /*
   * ==========================
   * LOAD SECTION DATA
   * ==========================
   *
   * Të gjithë përdoruesit e kyçur
   * mund ta përdorin këtë faqe.
   */
  useEffect(() => {
    if (!isLoaded || !isSignedIn || section === "messages") {
      return;
    }

    let ignore = false;

    getToken()
      .then(async (token) => {
        if (section === "properties") {
          const rows = await api("/api/properties/manage", {
            token,
          });

          if (!ignore) {
            setItems(rows.map(toAdminProperty));
          }
        } else if (section === "users") {
          const rows = await api("/api/users", {
            token,
          });

          if (!ignore) {
            setUsers(rows);
          }
        } else if (section === "services") {
          const rows = await api("/api/services", {
            token,
          });

          if (!ignore) {
            setServiceItems(rows);
          }
        }
      })
      .catch((error) => {
        if (!ignore) {
          setMessage(error.message);
        }
      });

    return () => {
      ignore = true;
    };
  }, [isLoaded, isSignedIn, section, getToken]);

  /*
   * ==========================
   * PHOTO PREVIEWS
   * ==========================
   */
  useEffect(() => {
    const urls = photos.map((file) =>
      URL.createObjectURL(file),
    );

    setPreviews(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  /*
   * ==========================
   * CLEAR PHOTOS
   * ==========================
   */
  function clearPhotos() {
    setPhotos([]);
    setExistingPhotos([]);

    if (photoInput.current) {
      photoInput.current.value = "";
    }
  }

  /*
   * ==========================
   * OPEN SECTION
   * ==========================
   */
  function openSection(id) {
    setSection(id);
    setMessage("");
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    clearPhotos();
  }

  /*
   * ==========================
   * ADD PHOTOS
   * ==========================
   */
  function addPhotos(fileList) {
    const incoming = Array.from(fileList || []);

    if (photoInput.current) {
      photoInput.current.value = "";
    }

    if (!incoming.length) {
      return;
    }

    const accepted = incoming.filter((file) =>
      /^image\/(jpeg|png|webp)$/.test(file.type),
    );

    if (!accepted.length) {
      setMessage(t("photosFailed"));
      return;
    }

    setMessage("");

    setPhotos((current) =>
      [...current, ...accepted].slice(0, MAX_PHOTOS),
    );
  }

  /*
   * ==========================
   * REMOVE PHOTO
   * ==========================
   */
  function removePhoto(index) {
    setPhotos((current) =>
      current.filter((_, i) => i !== index),
    );
  }

  /*
   * ==========================
   * UPDATE FORM
   * ==========================
   */
  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  /*
   * ==========================
   * START ADD
   * ==========================
   */
  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setMessage("");
    clearPhotos();
  }

  /*
   * ==========================
   * START EDIT
   * ==========================
   *
   * Redaktimi bëhet te:
   * /verwaltung/bearbeiten/:id
   */
  function startEdit(property) {
    navigate(`/verwaltung/bearbeiten/${property.id}`);
  }

  /*
   * ==========================
   * CANCEL EDIT
   * ==========================
   */
  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(false);
    clearPhotos();
  }

  /*
   * ==========================
   * REFRESH PROPERTIES
   * ==========================
   */
  async function refresh(token) {
    const rows = await api("/api/properties/manage", {
      token,
    });

    setItems(rows.map(toAdminProperty));
  }

  /*
   * ==========================
   * SAVE PROPERTY
   * ==========================
   */
  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");

    const place = placeFromLocation(form.location);

    const roomCounts = ROOM_FIELDS
      .map(([type]) => ({
        type,
        count: Number(form[type]),
      }))
      .filter((room) => room.count > 0);

    const body = {
      title: form.title,
      price: Number(form.price),

      ...place,

      rooms: form.rooms
        ? Number(form.rooms)
        : null,

      areaM2: Number(form.area),

      listingType: form.listingType,
      status: form.status,
      visibility: form.visibility,

      roomCounts,
    };

    try {
      const token = await getToken();

      const saved = await api(
        editingId
          ? `/api/properties/${editingId}`
          : "/api/properties",
        {
          method: editingId ? "PUT" : "POST",
          token,
          body,
        },
      );

      setEditingId(saved.id);

      if (photos.length) {
        const data = new FormData();

        photos.forEach((file) => {
          data.append("images", file);
        });

        await api(
          `/api/properties/${saved.id}/images`,
          {
            method: "POST",
            token,
            form: data,
          },
        );
      }

      cancelEdit();

      await refresh(token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  /*
   * ==========================
   * DELETE PROPERTY
   * ==========================
   */
  async function handleDelete(id) {
    if (!window.confirm(t("confirmDelete"))) {
      return;
    }

    setMessage("");

    try {
      const token = await getToken();

      await api(`/api/properties/${id}`, {
        method: "DELETE",
        token,
      });

      if (editingId === id) {
        cancelEdit();
      }

      await refresh(token);
    } catch (error) {
      setMessage(error.message);
    }
  }

  /*
   * ==========================
   * STATUS LABELS
   * ==========================
   */
  const statusLabel = {
    available: t("statusAvailable"),
    sold: t("statusSold"),
    rented: t("statusRented"),
  };

  /*
   * ==========================
   * UPDATE SERVICE
   * ==========================
   */
  function updateService(index, field, value) {
    setServiceItems((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  /*
   * ==========================
   * SAVE SERVICES
   * ==========================
   */
  async function saveServices(event) {
    event.preventDefault();

    setMessage("");

    try {
      const token = await getToken();

      const saved = await api("/api/services", {
        token,
        method: "PUT",
        body: {
          items: serviceItems,
        },
      });

      setServiceItems(saved);

      setMessage(t("servicesSaved"));
    } catch (error) {
      setMessage(error.message);
    }
  }

  /*
   * ==========================
   * PAGE TITLES
   * ==========================
   */
  const titles = {
    properties: t("adminNavProperties"),
    services: t("adminNavServices"),
    users: t("adminUsersTitle"),
    messages: t("adminMessagesTitle"),
  };

  /*
   * ==========================
   * RENDER
   * ==========================
   */
  return (
    <section className="section admin">

      {/* HEADER */}
      <header className="admin-top">
        <div>
          <p className="admin-eyebrow">
            Vanguard
          </p>

          <h1>
            {t("navAdmin")}
          </h1>
        </div>
      </header>

      {/* LOADING */}
      {!isLoaded ? (
        <p>{t("loading")}</p>
      ) : null}

      {/* NOT LOGGED IN */}
      {isLoaded && !isSignedIn ? (
        <p className="admin-message">
          {t("signInToAdd")}{" "}
          <Link to="/anmelden">
            {t("navLogin")}
          </Link>
        </p>
      ) : null}

      {/* ==========================
          LOGGED-IN USERS
      =========================== */}
      {isLoaded && isSignedIn ? (
        <div className="admin-shell">

          {/* SIDEBAR */}
          <aside className="admin-sidebar">

            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  section === item.id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  openSection(item.id)
                }
              >
                {t(item.label)}
              </button>
            ))}

          </aside>

          {/* PANEL */}
          <div className="admin-panel">

            {/* PANEL HEADER */}
            <div className="admin-panel-head">

              <h2>
                {titles[section]}

                {section === "properties" ? (
                  <span className="admin-count">
                    {items.length}
                  </span>
                ) : null}
              </h2>

              {section === "properties" ? (
                <button
                  type="button"
                  className="admin-add"
                  onClick={startAdd}
                >
                  {t("addNew")}
                </button>
              ) : null}

              {section === "services" ? (
                <button
                  type="button"
                  className="admin-add"
                  onClick={() =>
                    setServiceItems((current) => [
                      ...current,
                      emptyService,
                    ])
                  }
                >
                  {t("addNew")}
                </button>
              ) : null}

            </div>

            {/* ==========================
                PROPERTY FORM
            =========================== */}
            {section === "properties" &&
            showForm ? (
              <form
                className="admin-form"
                onSubmit={handleSubmit}
              >

                <label>
                  {t("fieldTitle")}

                  <input
                    name="title"
                    value={form.title}
                    onChange={updateField}
                    required
                  />
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

                  <select
                    name="listingType"
                    value={form.listingType}
                    onChange={updateField}
                  >
                    <option value="sale">
                      {t("listingSale")}
                    </option>

                    <option value="rent">
                      {t("listingRent")}
                    </option>
                  </select>
                </label>

                <label>
                  {t("fieldStatus")}

                  <select
                    name="status"
                    value={form.status}
                    onChange={updateField}
                  >
                    <option value="available">
                      {t("statusAvailable")}
                    </option>

                    <option value="rented">
                      {t("statusRented")}
                    </option>

                    <option value="sold">
                      {t("statusSold")}
                    </option>
                  </select>
                </label>

                <label>
                  {t("fieldVisibility")}

                  <select
                    name="visibility"
                    value={form.visibility}
                    onChange={updateField}
                  >
                    <option value="public">
                      {t("visibilityPublic")}
                    </option>

                    <option value="private">
                      {t("visibilityPrivate")}
                    </option>
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

                {/* ROOMS */}
                <div className="admin-rooms">

                  <span>
                    {t("roomsHint")}
                  </span>

                  <div className="admin-rooms-grid">

                    {ROOM_FIELDS.map(
                      ([type, label]) => (
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
                      ),
                    )}

                  </div>
                </div>

                {/* PHOTOS */}
                <div className="admin-photos">

                  <span className="admin-photos-label">
                    {t("fieldPhotos")}
                  </span>

                  <div
                    className={`photo-board${
                      existingPhotos.length ||
                      previews.length
                        ? " has-photos"
                        : ""
                    }`}
                  >

                    {existingPhotos.map(
                      (photo) => (
                        <div
                          className="photo-slot"
                          key={photo.Id}
                        >
                          <img
                            src={photo.Url}
                            alt=""
                          />
                        </div>
                      ),
                    )}

                    {previews.map(
                      (url, index) => (
                        <div
                          className="photo-slot"
                          key={url}
                        >
                          <img
                            src={url}
                            alt=""
                          />

                          <button
                            type="button"
                            className="photo-remove"
                            onClick={() =>
                              removePhoto(index)
                            }
                            aria-label={t(
                              "deleteProperty",
                            )}
                          >
                            ×
                          </button>
                        </div>
                      ),
                    )}

                    {/* ADD PHOTO */}
                    <button
                      type="button"
                      className="photo-slot photo-slot-add"
                      onClick={() =>
                        photoInput.current?.click()
                      }
                      aria-label={t(
                        "fieldPhotos",
                      )}
                    >
                      <span className="photo-add">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
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
                      onChange={(event) =>
                        addPhotos(
                          event.target.files,
                        )
                      }
                    />

                  </div>

                  <span>
                    {t("photosHint")}
                  </span>

                </div>

                {/* FORM ACTIONS */}
                <div className="admin-actions">

                  <button type="submit">
                    {editingId
                      ? t("saveProperty")
                      : t("addProperty")}
                  </button>

                  <button
                    type="button"
                    className="ghost"
                    onClick={cancelEdit}
                  >
                    {t("cancelEdit")}
                  </button>

                </div>

              </form>
            ) : null}

            {/* MESSAGE */}
            {message ? (
              <p className="admin-message">
                {message}
              </p>
            ) : null}

            {/* ==========================
                PROPERTIES
            =========================== */}
            {section === "properties" ? (
              items.length ? (
                <div className="property-grid">

                  {items.map((property) => (
                    <div key={property.id}>

                      <PropertiesCard
                        property={property}
                      />

                      <p className="admin-status">

                        <span
                          className={`pill pill-${property.status}`}
                        >
                          {statusLabel[
                            property.status
                          ] ||
                            property.status}
                        </span>

                        <span className="pill pill-vis">
                          {property.visibility ===
                          "private"
                            ? t(
                                "visibilityPrivate",
                              )
                            : t(
                                "visibilityPublic",
                              )}
                        </span>

                      </p>

                      <div className="admin-card-actions">

                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            startEdit(property)
                          }
                        >
                          {t("editProperty")}
                        </button>

                        <button
                          type="button"
                          className="danger"
                          onClick={() =>
                            handleDelete(
                              property.id,
                            )
                          }
                        >
                          {t("deleteProperty")}
                        </button>

                      </div>

                    </div>
                  ))}

                </div>
              ) : (
                <p className="admin-message">
                  {t("adminEmpty")}
                </p>
              )
            ) : null}

            {/* ==========================
                SERVICES
            =========================== */}
            {section === "services" ? (
              <form
                className="service-editor"
                onSubmit={saveServices}
              >

                {serviceItems.map(
                  (item, index) => (
                    <article
                      key={
                        item.id ||
                        `new-${index}`
                      }
                    >

                      <label>
                        {t("fieldTitleDe")}

                        <input
                          value={item.titleDe}
                          onChange={(event) =>
                            updateService(
                              index,
                              "titleDe",
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>

                      <label>
                        {t("fieldTitleEn")}

                        <input
                          value={item.titleEn}
                          onChange={(event) =>
                            updateService(
                              index,
                              "titleEn",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label>
                        {t("fieldTextDe")}

                        <textarea
                          value={item.textDe}
                          onChange={(event) =>
                            updateService(
                              index,
                              "textDe",
                              event.target.value,
                            )
                          }
                          required
                        />
                      </label>

                      <label>
                        {t("fieldTextEn")}

                        <textarea
                          value={item.textEn}
                          onChange={(event) =>
                            updateService(
                              index,
                              "textEn",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          setServiceItems(
                            (current) =>
                              current.filter(
                                (_, i) =>
                                  i !== index,
                              ),
                          )
                        }
                      >
                        {t("deleteProperty")}
                      </button>

                    </article>
                  ),
                )}

                <div className="service-editor-actions">
                  <button type="submit">
                    {t("saveProperty")}
                  </button>
                </div>

              </form>
            ) : null}

            {/* ==========================
                USERS
            =========================== */}
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

                        <td>
                          {user.FullName || "–"}
                        </td>

                        <td>
                          {user.Email || "–"}
                        </td>

                        <td>
                          {user.Role || "–"}
                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>
              ) : (
                <p className="admin-message">
                  {t("adminEmpty")}
                </p>
              )
            ) : null}

            {/* ==========================
                MESSAGES
            =========================== */}
            {section === "messages" ? (
              <SupportChat embedded />
            ) : null}

          </div>
        </div>
      ) : null}

    </section>
  );
}