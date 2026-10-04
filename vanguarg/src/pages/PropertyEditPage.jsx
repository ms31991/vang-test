import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { api, fromProperty } from "../api";
import { localized } from "../data/properties";
import { swissPlaces } from "../data/places";
import { useLanguage } from "../i18n/LanguageContext";
import { usePageSeo } from "../seo/usePageSeo";
import "./AdminPage.css";
import "./PropertyEditPage.css";

const ROOM_FIELDS = [
  ["living", "roomLiving"],
  ["bedroom", "roomBedroom"],
  ["kitchen", "roomKitchen"],
  ["bathroom", "roomBathroom"],
  ["wc", "roomWc"],
  ["balcony", "roomBalcony"],
];

const MAX_PHOTOS = 20;

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
    ROOM_FIELDS.map(([type]) => [
      type,
      counts[type]
        ? String(counts[type])
        : "",
    ]),
  );
}

function toAdminProperty(row) {
  return {
    ...fromProperty(row),
    status: row.Status,
    images: row.ImageUrls
      ? String(row.ImageUrls)
          .split("|")
          .filter(Boolean)
      : [],
  };
}

function placeFromLocation(location) {
  const place = swissPlaces.find(
    (item) =>
      item.de === location ||
      item.en === location,
  );

  const parent = place
    ? swissPlaces.find(
        (item) =>
          item.id === place.cityId,
      )
    : null;

  const neighborhood =
    place &&
    place.id !== place.cityId
      ? place.de
          .split("–")
          .pop()
          .trim()
      : null;

  return {
    city:
      parent?.de || location,
    cityId:
      place?.cityId || null,
    neighborhood,
    placeId:
      place?.id || null,
    lat:
      place?.lat ?? null,
    lng:
      place?.lng ?? null,
  };
}

export default function PropertyEditPage() {
  const { id } = useParams();

  const isEdit = Boolean(id);

  const navigate = useNavigate();

  const { lang, t } =
    useLanguage();

  const {
    isLoaded,
    isSignedIn,
    getToken,
  } = useAuth();

  usePageSeo({
    title: `${
      isEdit
        ? t("editProperty")
        : t("addNew")
    } | Vanguard`,

    description:
      t("adminSeo"),

    path: isEdit
      ? `/verwaltung/bearbeiten/${id}`
      : "/verwaltung/neu",

    noindex: true,
  });

  const [form, setForm] =
    useState(emptyForm);

  const [photos, setPhotos] =
    useState([]);

  const [previews, setPreviews] =
    useState([]);

  const [
    existingPhotos,
    setExistingPhotos,
  ] = useState([]);

  const [message, setMessage] =
    useState("");

  const [status, setStatus] =
    useState(
      isEdit
        ? "loading"
        : "ready",
    );

  const [saving, setSaving] =
    useState(false);

  const photoInput =
    useRef(null);

  // =====================================================
  // LOAD PROPERTY
  // =====================================================

  useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      !isEdit
    ) {
      return;
    }

    let ignore = false;

    setStatus("loading");

    async function loadProperty() {
      try {
        const token =
          await getToken();

        const rows =
          await api(
            "/api/properties/manage",
            {
              token,
            },
          );

        const property = rows
          .map(toAdminProperty)
          .find(
            (row) =>
              String(row.id) ===
              String(id),
          );

        if (!property) {
          throw new Error(
            "not-found",
          );
        }

        if (ignore) {
          return;
        }

        const titleDe =
          typeof property.title ===
          "object"
            ? property.title.de ||
              localized(
                property.title,
                lang,
              )
            : property.title;

        setForm({
          title:
            titleDe || "",

          location:
            localized(
              property.location,
              lang,
            ) || "",

          price:
            String(
              property.price ?? "",
            ),

          listingType:
            property.listingType ||
            "sale",

          status:
            property.status ||
            "available",

          visibility:
            property.visibility ||
            "public",

          rooms: property.rooms
            ? String(
                property.rooms,
              )
            : "",

          ...roomFields(
            property.roomCounts,
          ),

          area:
            String(
              property.area ?? "",
            ),
        });

        setExistingPhotos(
          (property.images ||
            []
          ).map(
            (url, index) => ({
              Id: `${url}-${index}`,
              Url: url,
            }),
          ),
        );

        setStatus("ready");

        // Additional detail data
        if (
          property.visibility ===
          "private"
        ) {
          return;
        }

        try {
          const detail =
            await api(
              `/api/properties/${id}`,
            );

          if (ignore) {
            return;
          }

          const counts =
            Object.fromEntries(
              (detail.rooms ||
                []
              ).map(
                (room) => [
                  room.RoomType,
                  room.Quantity,
                ],
              ),
            );

          setForm(
            (current) => ({
              ...current,

              status:
                detail.Status ||
                current.status,

              visibility:
                detail.Visibility ||
                current.visibility,

              ...roomFields(
                counts,
              ),
            }),
          );

          if (
            detail.images?.length
          ) {
            setExistingPhotos(
              detail.images,
            );
          }
        } catch {
          // Additional details are optional
        }
      } catch (error) {
        if (!ignore) {
          setStatus("error");

          setMessage(
            error.message ===
              "not-found"
              ? ""
              : error.message,
          );
        }
      }
    }

    loadProperty();

    return () => {
      ignore = true;
    };
  }, [
    isLoaded,
    isSignedIn,
    isEdit,
    id,
    getToken,
    lang,
  ]);

  // =====================================================
  // PHOTO PREVIEWS
  // =====================================================

  useEffect(() => {
    const urls = photos.map(
      (file) =>
        URL.createObjectURL(file),
    );

    setPreviews(urls);

    return () => {
      urls.forEach((url) =>
        URL.revokeObjectURL(
          url,
        ),
      );
    };
  }, [photos]);

  // =====================================================
  // UPDATE FORM
  // =====================================================

  function updateField(event) {
    setForm((current) => ({
      ...current,

      [event.target.name]:
        event.target.value,
    }));
  }

  // =====================================================
  // ADD PHOTOS
  // =====================================================

  function addPhotos(fileList) {
    const incoming =
      Array.from(
        fileList || [],
      );

    if (photoInput.current) {
      photoInput.current.value =
        "";
    }

    if (!incoming.length) {
      return;
    }

    const accepted =
      incoming.filter(
        (file) =>
          /^image\/(jpeg|png|webp)$/.test(
            file.type,
          ),
      );

    if (!accepted.length) {
      setMessage(
        t("photosFailed"),
      );

      return;
    }

    setMessage("");

    setPhotos(
      (current) =>
        [
          ...current,
          ...accepted,
        ].slice(
          0,
          MAX_PHOTOS,
        ),
    );
  }

  // =====================================================
  // REMOVE PHOTO
  // =====================================================

  function removePhoto(index) {
    setPhotos(
      (current) =>
        current.filter(
          (_, i) =>
            i !== index,
        ),
    );
  }

  // =====================================================
  // SAVE PROPERTY
  // =====================================================

  async function handleSubmit(
    event,
  ) {
    event.preventDefault();

    setMessage("");
    setSaving(true);

    const place =
      placeFromLocation(
        form.location,
      );

    const roomCounts =
      ROOM_FIELDS
        .map(([type]) => ({
          type,
          count: Number(
            form[type],
          ),
        }))
        .filter(
          (room) =>
            room.count > 0,
        );

    const body = {
      title:
        form.title,

      price:
        Number(form.price),

      ...place,

      rooms: form.rooms
        ? Number(form.rooms)
        : null,

      areaM2:
        Number(form.area),

      listingType:
        form.listingType,

      status:
        form.status,

      visibility:
        form.visibility,

      roomCounts,
    };

    try {
      const token =
        await getToken();

      const saved =
        await api(
          isEdit
            ? `/api/properties/${id}`
            : "/api/properties",
          {
            method:
              isEdit
                ? "PUT"
                : "POST",

            token,

            body,
          },
        );

      // Upload new photos
      if (photos.length) {
        const data =
          new FormData();

        photos.forEach(
          (file) => {
            data.append(
              "images",
              file,
            );
          },
        );

        await api(
          `/api/properties/${saved.id}/images`,
          {
            method: "POST",
            token,
            form: data,
          },
        );
      }

      navigate(
        "/verwaltung",
      );
    } catch (error) {
      setMessage(
        error.message,
      );

      setSaving(false);
    }
  }

  // =====================================================
  // DELETE PROPERTY
  // =====================================================

  async function handleDelete() {
    if (
      !window.confirm(
        t("confirmDelete"),
      )
    ) {
      return;
    }

    setMessage("");

    try {
      const token =
        await getToken();

      await api(
        `/api/properties/${id}`,
        {
          method: "DELETE",
          token,
        },
      );

      navigate(
        "/verwaltung",
      );
    } catch (error) {
      setMessage(
        error.message,
      );
    }
  }

  const heading = isEdit
    ? t("editProperty")
    : t("addNew");

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <section className="section edit-page">

      {/* BACK */}
      <Link
        to="/verwaltung"
        className="edit-back"
      >
        {t("goBack")}
      </Link>

      {/* LOADING AUTH */}
      {!isLoaded ? (
        <p>
          {t("loading")}
        </p>
      ) : null}

      {/* NOT LOGGED IN */}
      {isLoaded &&
      !isSignedIn ? (
        <p className="admin-message">
          {t("signInToAdd")}{" "}

          <Link to="/anmelden">
            {t("navLogin")}
          </Link>
        </p>
      ) : null}

      {/* LOGGED-IN USER */}
      {isLoaded &&
      isSignedIn ? (
        <>
          {/* HEADER */}
          <header className="edit-head">

            <div>
              <p className="admin-eyebrow">
                Vanguard
              </p>

              <h1>
                {heading}
              </h1>

              {isEdit &&
              form.title ? (
                <p className="edit-sub">
                  {form.title}
                </p>
              ) : null}
            </div>

            {isEdit &&
            status ===
              "ready" ? (
              <button
                type="button"
                className="edit-delete"
                onClick={
                  handleDelete
                }
              >
                {t(
                  "deleteProperty",
                )}
              </button>
            ) : null}

          </header>

          {/* MESSAGE */}
          {message ? (
            <p className="admin-message">
              {message}
            </p>
          ) : null}

          {/* LOADING PROPERTY */}
          {status ===
          "loading" ? (
            <p>
              {t("loading")}
            </p>
          ) : null}

          {/* ERROR */}
          {status ===
            "error" &&
          !message ? (
            <p className="admin-message">
              {t(
                "locNoResults",
              )}
            </p>
          ) : null}

          {/* FORM */}
          {status ===
          "ready" ? (
            <form
              className="admin-form edit-form"
              onSubmit={
                handleSubmit
              }
            >

              {/* BASIC INFORMATION */}
              <p className="edit-heading">
                {t(
                  "fieldTitle",
                )}{" "}
                ·{" "}
                {t(
                  "fieldLocation",
                )}
              </p>

              <label>
                {t(
                  "fieldTitle",
                )}

                <input
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    updateField
                  }
                  required
                />
              </label>

              <label>
                {t(
                  "fieldLocation",
                )}

                <input
                  name="location"
                  value={
                    form.location
                  }
                  onChange={
                    updateField
                  }
                  required
                />
              </label>

              <label>
                {t(
                  "fieldPrice",
                )}

                <input
                  name="price"
                  type="number"
                  min="1"
                  value={
                    form.price
                  }
                  onChange={
                    updateField
                  }
                  required
                />
              </label>

              {/* LISTING */}
              <p className="edit-heading">
                {t(
                  "fieldListing",
                )}{" "}
                ·{" "}
                {t(
                  "fieldStatus",
                )}
              </p>

              <label>
                {t(
                  "fieldListing",
                )}

                <select
                  name="listingType"
                  value={
                    form.listingType
                  }
                  onChange={
                    updateField
                  }
                >
                  <option value="sale">
                    {t(
                      "listingSale",
                    )}
                  </option>

                  <option value="rent">
                    {t(
                      "listingRent",
                    )}
                  </option>
                </select>
              </label>

              <label>
                {t(
                  "fieldStatus",
                )}

                <select
                  name="status"
                  value={
                    form.status
                  }
                  onChange={
                    updateField
                  }
                >
                  <option value="available">
                    {t(
                      "statusAvailable",
                    )}
                  </option>

                  <option value="rented">
                    {t(
                      "statusRented",
                    )}
                  </option>

                  <option value="sold">
                    {t(
                      "statusSold",
                    )}
                  </option>
                </select>
              </label>

              <label>
                {t(
                  "fieldVisibility",
                )}

                <select
                  name="visibility"
                  value={
                    form.visibility
                  }
                  onChange={
                    updateField
                  }
                >
                  <option value="public">
                    {t(
                      "visibilityPublic",
                    )}
                  </option>

                  <option value="private">
                    {t(
                      "visibilityPrivate",
                    )}
                  </option>
                </select>
              </label>

              <label>
                {t(
                  "fieldRooms",
                )}

                <input
                  name="rooms"
                  type="number"
                  min="1"
                  value={
                    form.rooms
                  }
                  onChange={
                    updateField
                  }
                />
              </label>

              <label>
                {t(
                  "fieldArea",
                )}

                <input
                  name="area"
                  type="number"
                  min="1"
                  value={
                    form.area
                  }
                  onChange={
                    updateField
                  }
                  required
                />
              </label>

              {/* ROOMS */}
              <div className="admin-rooms">

                <span>
                  {t(
                    "roomsHint",
                  )}
                </span>

                <div className="admin-rooms-grid">

                  {ROOM_FIELDS.map(
                    ([
                      type,
                      label,
                    ]) => (
                      <label
                        key={
                          type
                        }
                      >
                        {t(
                          label,
                        )}

                        <input
                          name={
                            type
                          }
                          type="number"
                          min="1"
                          value={
                            form[
                              type
                            ]
                          }
                          onChange={
                            updateField
                          }
                        />
                      </label>
                    ),
                  )}

                </div>
              </div>

              {/* PHOTOS */}
              <div className="admin-photos">

                <span className="admin-photos-label">
                  {t(
                    "fieldPhotos",
                  )}
                </span>

                <div
                  className={`photo-board${
                    existingPhotos.length ||
                    previews.length
                      ? " has-photos"
                      : ""
                  }`}
                >

                  {/* EXISTING */}
                  {existingPhotos.map(
                    (photo) => (
                      <div
                        className="photo-slot"
                        key={
                          photo.Id
                        }
                      >
                        <img
                          src={
                            photo.Url
                          }
                          alt=""
                        />
                      </div>
                    ),
                  )}

                  {/* NEW */}
                  {previews.map(
                    (
                      url,
                      index,
                    ) => (
                      <div
                        className="photo-slot"
                        key={
                          url
                        }
                      >
                        <img
                          src={url}
                          alt=""
                        />

                        <button
                          type="button"
                          className="photo-remove"
                          onClick={() =>
                            removePhoto(
                              index,
                            )
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
                    ref={
                      photoInput
                    }
                    className="photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(
                      event,
                    ) =>
                      addPhotos(
                        event
                          .target
                          .files,
                      )
                    }
                  />

                </div>

                <span>
                  {t(
                    "photosHint",
                  )}
                </span>

              </div>

              {/* ACTIONS */}
              <div className="admin-actions">

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                >
                  {isEdit
                    ? t(
                        "saveProperty",
                      )
                    : t(
                        "addProperty",
                      )}
                </button>

                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    navigate(
                      "/verwaltung",
                    )
                  }
                  disabled={
                    saving
                  }
                >
                  {t(
                    "cancelEdit",
                  )}
                </button>

              </div>

            </form>
          ) : null}
        </>
      ) : null}

    </section>
  );
}