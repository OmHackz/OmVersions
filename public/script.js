(function () {
  const BASE = window.location.origin;
  const grid = document.getElementById("projectGrid");
  const countEl = document.getElementById("projectCount");
  const releaseCountEl = document.getElementById("releaseCount");
  const copyBtn = document.querySelector(".copy-url");

  async function fetchJson(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error("Failed to load " + path);
    return res.json();
  }

  async function render() {
    try {
      const data = await fetchJson(`${BASE}/api/v1/projects`);
      const projects = data.data.projects || [];

      if (countEl) countEl.textContent = projects.length;

      grid.innerHTML = "";
      let releasesFound = 0;

      for (const project of projects) {
        const card = document.createElement("div");
        card.className = "project-card";

        const nameEl = document.createElement("div");
        nameEl.className = "project-name";
        nameEl.textContent = project.displayName || project.id;

        const repoEl = document.createElement("div");
        repoEl.className = "project-repo";
        repoEl.textContent = project.repository;

        card.appendChild(nameEl);
        card.appendChild(repoEl);

        try {
          const latest = await fetchJson(`${BASE}/api/v1/${project.id}/latest`);
          const release = latest.data;
          if (release && release.version) {
            releasesFound++;
            const info = document.createElement("div");
            info.className = "release-info";
            info.textContent = `Latest stable: ${release.version}`;
            card.appendChild(info);
          } else {
            const muted = document.createElement("div");
            muted.className = "release-muted";
            muted.textContent = "No releases yet";
            card.appendChild(muted);
          }
        } catch (e) {
          const muted = document.createElement("div");
          muted.className = "release-muted";
          muted.textContent = "Release info unavailable";
          card.appendChild(muted);
        }

        grid.appendChild(card);
      }

      if (releaseCountEl) releaseCountEl.textContent = releasesFound;
    } catch (e) {
      grid.innerHTML = '<div class="placeholder">Unable to load projects.</div>';
    }
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = copyBtn.getAttribute("data-clipboard");
      try {
        await navigator.clipboard.writeText(text);
        const old = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = old; }, 1500);
      } catch (e) {
        /* clipboard unavailable */
      }
    });
  }

  render();
})();
