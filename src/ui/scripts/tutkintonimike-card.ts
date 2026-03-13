export type TutkintonimikeCardItem = {
  nimi: string;
  linkki: string | null;
  img: string | null;
  tutkinto_nimi?: string;
};

type CreateTutkintonimikeCardOptions = {
  titleTag?: "h3" | "h4";
  allowLink?: boolean;
  rootTag?: "article" | "div";
};

export type TutkintonimikeCardElements = {
  root: HTMLElement;
  media: HTMLElement;
  body: HTMLDivElement;
  title: HTMLHeadingElement;
  titleContent: HTMLAnchorElement | HTMLSpanElement;
  meta: HTMLParagraphElement | null;
};

function createImageElement(item: TutkintonimikeCardItem): HTMLElement {
  if (!item.img) {
    const placeholder = document.createElement("div");
    placeholder.className = "tutkintonimike-image tutkintonimike-image--placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    return placeholder;
  }

  const image = document.createElement("img");
  image.className = "tutkintonimike-image";
  image.src = item.img;
  image.alt = item.nimi;
  image.addEventListener("error", () => {
    const placeholder = document.createElement("div");
    placeholder.className = "tutkintonimike-image tutkintonimike-image--placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    image.replaceWith(placeholder);
  });
  return image;
}

export function createTutkintonimikeCard(
  item: TutkintonimikeCardItem,
  options: CreateTutkintonimikeCardOptions = {}
): TutkintonimikeCardElements {
  const { titleTag = "h3", allowLink = true, rootTag = "article" } = options;

  const root = document.createElement(rootTag);
  root.className = "tutkintonimike-card";

  const media = createImageElement(item);
  const body = document.createElement("div");
  body.className = "tutkintonimike-card-body";

  const title = document.createElement(titleTag);
  const titleContent =
    item.linkki && allowLink ? document.createElement("a") : document.createElement("span");
  titleContent.textContent = item.nimi;
  titleContent.className = "tutkintonimike-link";

  if (titleContent instanceof HTMLAnchorElement) {
    titleContent.href = item.linkki ?? "";
    titleContent.target = "_blank";
    titleContent.rel = "noreferrer";
  }

  title.append(titleContent);
  body.append(title);

  let meta: HTMLParagraphElement | null = null;
  if (item.tutkinto_nimi) {
    meta = document.createElement("p");
    meta.className = "tutkintonimike-meta";
    meta.textContent = item.tutkinto_nimi;
    body.append(meta);
  }

  root.append(media, body);

  return {
    root,
    media,
    body,
    title,
    titleContent,
    meta
  };
}
