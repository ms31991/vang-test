import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { api } from "../api";
import { useLanguage } from "../i18n/LanguageContext";
import "./SupportChat.css";

function formatWhen(value, lang) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(lang === "de" ? "de-CH" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initial(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

const topicJobs = new Map();

function fill(template, name) {
  return template.replace("{name}", name);
}

export default function SupportChat({ embedded = false }) {
  const { lang, t } = useLanguage();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [role, setRole] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [peerName, setPeerName] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [showList, setShowList] = useState(true);
  const scroller = useRef(null);
  const staff = role === "admin" || role === "owner";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setRole("");
      return;
    }
    let ignore = false;
    getToken()
      .then((token) => api("/api/me", { token }))
      .then((me) => {
        if (!ignore) setRole(me.role || "client");
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      });
    return () => {
      ignore = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn) return undefined;
    let stopped = false;

    async function beat(open) {
      try {
        const token = await getToken();
        if (!token || (stopped && open)) return;
        await fetch("/api/messages/presence", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ open }),
          keepalive: true,
        });
      } catch {
        /* presence is optional */
      }
    }

    const sync = () => beat(document.visibilityState === "visible");
    sync();
    const timer = window.setInterval(sync, 8000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      beat(false);
    };
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isSignedIn || !user) return undefined;
    const email = user.primaryEmailAddress?.emailAddress || "";
    const name = user.fullName || "";
    if (!email && !name) return undefined;
    getToken()
      .then((token) => api("/api/me", { token, method: "PUT", body: { email, name } }))
      .catch(() => {});
    return undefined;
  }, [isSignedIn, user, getToken]);

  useEffect(() => {
    if (!role) return undefined;
    let ignore = false;

    async function load() {
      try {
        const token = await getToken();
        const rows = await api("/api/messages/conversations", { token });
        if (ignore) return;
        setConversations(rows);
        setActiveId((current) => {
          if (staff) return current && rows.some((row) => row.id === current) ? current : null;
          return rows[0]?.id ?? null;
        });
        if (!staff && rows[0]) setPeerName(rows[0].name);
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [role, staff, getToken]);

  useEffect(() => {
    if (!role || !activeId) {
      if (staff) {
        setMessages([]);
        setPeerName("");
      }
      return undefined;
    }
    let ignore = false;

    async function loadThread() {
      try {
        const token = await getToken();
        const data = await api(`/api/messages/with/${activeId}`, { token });
        if (ignore) return;
        setPeerName(data.peer?.name || "");
        setMessages((current) => {
          const incoming = data.messages || [];
          const ids = new Set(incoming.map((item) => item.id));
          const extra = current.filter((item) => !ids.has(item.id));
          return extra.length ? [...incoming, ...extra] : incoming;
        });
        setConversations((current) =>
          current.map((row) => (row.id === activeId ? { ...row, unread: 0 } : row)),
        );
      } catch (err) {
        if (!ignore) setError(err.message);
      }
    }

    loadThread();
    const timer = window.setInterval(loadThread, 4000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [role, activeId, staff, getToken]);

  useEffect(() => {
    if (!role || staff) return undefined;
    const service = params.get("service");
    const property = params.get("property");
    if (!service && !property) return undefined;
    const key = service ? `service:${service}` : `property:${property}`;
    if (!topicJobs.has(key)) {
      topicJobs.set(key, (async () => {
        let text = "";
        let propertyId;
        if (service) {
          const rows = await api("/api/services");
          const item = rows.find((row) => String(row.id) === service);
          const name = item
            ? (lang === "en" ? item.titleEn || item.titleDe : item.titleDe)
            : t(service);
          if (!name || name === service) throw new Error("service");
          text = fill(t("chatAboutService"), name);
        } else {
          const row = await api(`/api/properties/${property}`);
          const name = lang === "en" ? row.TitleEn || row.Title : row.Title;
          const place = row.Neighborhood ? `${row.City} – ${row.Neighborhood}` : row.City;
          const label = place ? `${name}, ${place}` : name;
          text = fill(t(row.ListingType === "rent" ? "chatWantRent" : "chatWantBuy"), label);
          propertyId = Number(property);
        }
        const token = await getToken();
        return api("/api/messages", {
          token,
          method: "POST",
          body: { body: text, propertyId },
        });
      })().catch((err) => {
        topicJobs.delete(key);
        throw err;
      }));
    }

    let alive = true;
    topicJobs.get(key)
      .then((saved) => {
        if (!alive || !saved?.id) return;
        setMessages((current) => (current.some((item) => item.id === saved.id) ? current : [...current, saved]));
        setParams({}, { replace: true });
      })
      .catch((err) => {
        if (alive && err?.message && err.message !== "service") setError(err.message);
      });

    return () => {
      alive = false;
    };
  }, [role, staff, params, lang, t, getToken, setParams]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeId]);

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending || (staff && !activeId)) return;
    setSending(true);
    setError("");
    try {
      const token = await getToken();
      const saved = await api("/api/messages", {
        token,
        method: "POST",
        body: { body: text, toUserId: activeId },
      });
      setDraft("");
      setMessages((current) => [...current, saved]);
      setConversations((current) =>
        current.map((row) =>
          row.id === activeId ? { ...row, lastBody: saved.body, lastAt: saved.sentAt } : row,
        ),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  function openConversation(id) {
    setActiveId(id);
    setShowList(false);
  }

  if (!isLoaded) return null;

  if (isSignedIn && !role && !error) return null;

  if (!isSignedIn) {
    return (
      <section className={`chat-page${embedded ? " is-embedded" : ""}`}>
        <div className="chat-gate">
          <h1>{t("navSupport")}</h1>
          <p>{t("chatLogin")}</p>
          <Link to={`/hyr?redirect_url=${encodeURIComponent(`/inbox${location.search}`)}`}>{t("navLogin")}</Link>
        </div>
      </section>
    );
  }

  const threadOpen = !staff || activeId;

  return (
    <section className={`chat-page${embedded ? " is-embedded" : ""}${staff ? "" : " is-client"}`}>
      {!embedded && staff ? <h1>{t("navInbox")}</h1> : null}
      {!embedded && !staff ? (
        <header className="chat-intro">
          <h1>{t("navSupport")}</h1>
          <p>{t("chatLead")}</p>
        </header>
      ) : null}

      <div className={`chat-desk${staff ? "" : " is-client"}${showList ? "" : " thread-open"}`}>
        {staff ? (
          <aside className="chat-contacts">
            <h2>{t("chatContacts")}</h2>
            {conversations.length ? (
              <ul>
                {conversations.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      className={person.id === activeId ? "active" : ""}
                      onClick={() => openConversation(person.id)}
                    >
                      <span className="chat-avatar">{initial(person.name)}</span>
                      <span className="chat-contact-copy">
                        <strong>{person.name}</strong>
                        <em>{person.lastBody || t("chatEmpty")}</em>
                      </span>
                      {person.unread > 0 ? <span className="chat-unread">{person.unread}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="chat-empty">{t("chatNoContacts")}</p>
            )}
          </aside>
        ) : null}

        <div className="chat-thread">
          {threadOpen ? (
            <>
              <header className="chat-thread-head">
                {staff ? (
                  <button type="button" className="chat-back" onClick={() => setShowList(true)}>
                    {t("chatBack")}
                  </button>
                ) : null}
                <h2>{peerName || t("navSupport")}</h2>
              </header>
              <div className="chat-log" ref={scroller}>
                {messages.length ? (
                  messages.map((item) => (
                    <article key={item.id} className={item.mine ? "mine" : "theirs"}>
                      <p>{item.body}</p>
                      <time>{formatWhen(item.sentAt, lang)}</time>
                    </article>
                  ))
                ) : (
                  <p className="chat-empty">{t("chatEmpty")}</p>
                )}
              </div>
              <form className="chat-compose" onSubmit={sendMessage}>
                <textarea
                  value={draft}
                  maxLength={2000}
                  rows={2}
                  placeholder={t("chatPlaceholder")}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" disabled={sending || !draft.trim()}>
                  {t("chatSend")}
                </button>
              </form>
            </>
          ) : (
            <p className="chat-empty chat-pick">{t("chatPick")}</p>
          )}
        </div>
      </div>
      {error ? <p className="chat-error">{error}</p> : null}
    </section>
  );
}
