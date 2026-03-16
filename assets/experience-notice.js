(() => {
  const scriptTag = document.currentScript;
  if (!scriptTag || !document.body) {
    return;
  }

  const noticeUrl =
    scriptTag.dataset.noticeUrl ||
    "https://romiojoseph.github.io/atproto-explorer/";
  const noticeTitle =
    scriptTag.dataset.noticeTitle || "A better experience is available";
  const noticeDescription =
    scriptTag.dataset.noticeDescription ||
    "A unified explorer with faster navigation, bug fixes, and improved functionality. It can also be installed as a PWA: open your browser menu and select \"Add to home screen\"";
  const noticeButton =
    scriptTag.dataset.noticeButton || "Try it now ";

  const notice = document.createElement("section");
  notice.className = "experience-notice";
  notice.setAttribute("role", "dialog");
  notice.setAttribute("aria-live", "polite");

  const heading = document.createElement("h2");
  heading.className = "experience-notice__heading";
  heading.textContent = noticeTitle;

  const description = document.createElement("p");
  description.className = "experience-notice__description";
  description.textContent = noticeDescription;

  const actions = document.createElement("div");
  actions.className = "experience-notice__actions";

  const button = document.createElement("a");
  button.className = "experience-notice__button";
  button.href = noticeUrl;
  button.target = "_blank";
  button.rel = "noreferrer";
  button.textContent = noticeButton;

  const closeButton = document.createElement("button");
  closeButton.className = "experience-notice__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close notification");
  closeButton.textContent = "×";

  closeButton.addEventListener("click", () => {
    notice.classList.add("experience-notice--hide");
    window.setTimeout(() => {
      notice.remove();
    }, 240);
  });

  actions.append(button);
  notice.append(heading, description, actions, closeButton);
  document.body.append(notice);
})();
