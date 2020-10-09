// Add anchors to headings
document
    .querySelectorAll(
        "section.content h1, " +
            "section.content h2, " +
            "section.content h3, " +
            "section.content h4, " +
            "section.content h5, " +
            "section.content h6"
    )
    .forEach((heading) => {
        const anchor = document.createElement("a");
        anchor.className = "anchor";
        anchor.href = `#${heading.id}`;
        anchor.innerHTML = `<i class="fas fa-link"></i>`;
        heading.insertAdjacentElement("afterbegin", anchor);
    });
