import { useEffect, useState } from "react";
import PropertiesCard from "./PropertiesCard";

export default function PropertyCategory({ id, title, items, empty, action, cycle = false }) {
  const [list, setList] = useState(items);
  const [sliding, setSliding] = useState(false);

  useEffect(() => {
    setList(items);
  }, [items]);

  useEffect(() => {
    if (!cycle || items.length < 2) return undefined;

    let timer;
    const interval = setInterval(() => {
      setSliding(true);
      timer = setTimeout(() => {
        setList((prev) => {
          if (prev.length < 2) return prev;
          return [...prev.slice(1), prev[0]];
        });
        setSliding(false);
      }, 700);
    }, 12000);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [cycle, items.length]);

  function handleWheel(event) {
    const el = event.currentTarget;
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }

  function handlePointerDown(event) {
    if (event.pointerType === "touch") return;
    const el = event.currentTarget;
    el.dataset.dragging = "false";
    el.dataset.didDrag = "false";
    el.dataset.startX = String(event.clientX);
    el.dataset.startScroll = String(el.scrollLeft);
  }

  function handlePointerMove(event) {
    const el = event.currentTarget;
    if (el.dataset.startX == null || el.dataset.startX === "") return;

    const startX = Number(el.dataset.startX);
    const delta = event.clientX - startX;

    if (el.dataset.dragging !== "true") {
      if (Math.abs(delta) < 8) return;
      el.dataset.dragging = "true";
      el.dataset.didDrag = "true";
      el.setPointerCapture(event.pointerId);
    }

    el.scrollLeft = Number(el.dataset.startScroll) - delta;
  }

  function handlePointerUp(event) {
    const el = event.currentTarget;
    if (el.hasPointerCapture?.(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    el.dataset.dragging = "false";
    el.dataset.startX = "";
    window.setTimeout(() => {
      el.dataset.didDrag = "false";
    }, 0);
  }

  function handleCardClick(event) {
    const carousel = event.currentTarget.closest(".home-carousel");
    if (carousel?.dataset.didDrag === "true") event.preventDefault();
  }

  return (
    <div className="property-category" id={id}>
      <div className="section-head">
        <h2>{title}</h2>
        {action}
      </div>
      {cycle && list.length ? (
        <div
          className="home-carousel"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className={`home-carousel-track${sliding ? " sliding" : ""}`}>
            {list.map((property, index) => (
              <div className="home-carousel-item" key={`${property.id}-${index}`}>
                <PropertiesCard property={property} onClick={handleCardClick} />
              </div>
            ))}
          </div>
        </div>
      ) : items.length ? (
        <div className="property-grid">
          {items.map((property) => (
            <PropertiesCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <p className="properties-empty">{empty}</p>
      )}
    </div>
  );
}
