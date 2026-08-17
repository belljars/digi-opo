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
  showLinkAction?: boolean;
};

export type TutkintonimikeCardElements = {
  root: HTMLElement;
  media: HTMLElement;
  body: HTMLDivElement;
  title: HTMLHeadingElement;
  titleContent: HTMLAnchorElement | HTMLSpanElement;
  meta: HTMLParagraphElement | null;
  actions: HTMLDivElement;
  linkAction: HTMLAnchorElement | null;
};

function createImageElement(item: TutkintonimikeCardItem): HTMLElement {
  if (!item.img) {
    const placeholder = document.createElement("div");
    placeholder.className = "tutkintonimike-kuva tutkintonimike-kuva--paikanvaraaja";
    placeholder.setAttribute("aria-hidden", "true");
    return placeholder;
  }

  const image = document.createElement("img");
  image.className = "tutkintonimike-kuva";
  image.src = item.img;
  image.alt = item.nimi;
  image.addEventListener("error", () => {
    const placeholder = document.createElement("div");
    placeholder.className = "tutkintonimike-kuva tutkintonimike-kuva--paikanvaraaja";
    placeholder.setAttribute("aria-hidden", "true");
    image.replaceWith(placeholder);
  });
  return image;
}

export function createTutkintonimikeLinkAction(linkki: string | null): HTMLAnchorElement | null {
  if (!linkki) {
    return null;
  }

  const linkAction = document.createElement("a");
  linkAction.className = "tutkintonimike-linkki-toiminto";
  linkAction.href = linkki;
  linkAction.target = "_blank";
  linkAction.rel = "noreferrer";
  linkAction.textContent = "Avaa tutkintonimike";
  return linkAction;
}

export function createTutkintonimikeCard(
  item: TutkintonimikeCardItem,
  options: CreateTutkintonimikeCardOptions = {}
): TutkintonimikeCardElements {
  const { titleTag = "h3", allowLink = true, rootTag = "article", showLinkAction = true } = options;

  const root = document.createElement(rootTag);
  root.className = "tutkintonimike-kortti";

  const media = createImageElement(item);
  const body = document.createElement("div");
  body.className = "tutkintonimike-kortti-sisalto";

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
    meta.className = "tutkintonimike-tiedot";
    meta.textContent = item.tutkinto_nimi;
    body.append(meta);
  }

  const actions = document.createElement("div");
  actions.className = "tutkintonimike-kortti-toiminnot";

  const linkAction = showLinkAction ? createTutkintonimikeLinkAction(item.linkki) : null;
  if (linkAction) {
    actions.append(linkAction);
  }

  if (actions.childElementCount > 0) {
    body.append(actions);
  }

  root.append(media, body);

  return {
    root,
    media,
    body,
    title,
    titleContent,
    meta,
    actions,
    linkAction
  };
}
