// ==UserScript==
// @name         Vinted Favorites Organizer
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Organizador de favoritos do Vinted
// @match        https://www.vinted.pt/member/items/favourite_list*
// @grant        none
// @run-at       document-start
// ==/UserScript==
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // src/main.js
  var require_main = __commonJS({
    "src/main.js"() {
      (function() {
        "use strict";
        let vintedCsrfToken = null;
        const originalFetch = window.fetch.bind(window);
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        window.fetch = async function(input, init2) {
          try {
            let headers = null;
            if (init2 && init2.headers) {
              headers = new Headers(
                init2.headers
              );
            } else if (input instanceof Request) {
              headers = input.headers;
            }
            if (headers) {
              const token = headers.get(
                "X-Csrf-Token"
              );
              if (token) {
                vintedCsrfToken = token;
                console.log(
                  "CSRF token do Vinted capturado."
                );
              }
            }
          } catch (error) {
            console.warn(
              "N\xE3o foi poss\xEDvel inspeccionar headers do fetch:",
              error
            );
          }
          return originalFetch(
            input,
            init2
          );
        };
        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
          if (String(name).toLowerCase() === "x-csrf-token") {
            vintedCsrfToken = String(value);
            console.log(
              "CSRF token do Vinted capturado."
            );
          }
          return originalSetRequestHeader.call(
            this,
            name,
            value
          );
        };
        window.hasVintedCsrfToken = function() {
          return Boolean(
            vintedCsrfToken
          );
        };
        const SELECTORS = {
          listing: '[data-testid="grid-item"]',
          itemLink: 'a[href*="/items/"]',
          price: '[data-testid$="--price-text"]',
          brand: '[data-testid$="--description-title"]'
        };
        const UI_IDS = {
          viewVinted: "vinted-view-vinted",
          viewOrganizer: "vinted-view-organizer",
          viewDashboard: "vinted-view-dashboard",
          dashboardView: "vinted-dashboard-view",
          organizerView: "vinted-organizer-view",
          organizerGrid: "vinted-organizer-grid",
          organizerViewCount: "vinted-organizer-view-count",
          panel: "vinted-organizer",
          sort: "vinted-sort",
          loadAll: "vinted-load-all",
          loadStatus: "vinted-load-status",
          nameFilter: "vinted-name-filter",
          priceMin: "vinted-price-min",
          priceMax: "vinted-price-max",
          brandFilter: "vinted-brand-filter",
          typeFilter: "vinted-type-filter",
          statusFilter: "vinted-status-filter",
          resultCount: "vinted-result-count",
          applyFilters: "vinted-apply-filters",
          clearFilters: "vinted-clear-filters",
          priceHistory: "vinted-price-history",
          priceHistorySummary: "vinted-price-history-summary",
          removeSold: "vinted-remove-sold",
          removeSoldStatus: "vinted-remove-sold-status",
          soldHistoryButton: "vinted-sold-history-button",
          soldHistoryView: "vinted-sold-history-view",
          soldHistoryGrid: "vinted-sold-history-grid",
          soldHistoryCount: "vinted-sold-history-count",
          soldHistoryClose: "vinted-sold-history-close",
          folderList: "vinted-folder-list",
          folderNameInput: "vinted-folder-name-input",
          folderCreateButton: "vinted-folder-create-button"
        };
        let currentView = "vinted";
        let currentFolderFilter = "all";
        let activeFolderMenu = null;
        let activeFolderMenuCleanup = null;
        const FOLDER_FILTER_ALL = "all";
        const FOLDER_FILTER_UNFILED = "unfiled";
        const listingCache = /* @__PURE__ */ new Map();
        const STORAGE_KEY = "vintedFavoritesOrganizer_listingCache_v1";
        const PANEL_LAYOUT_STORAGE_KEY = "vintedFavoritesOrganizer_panelLayout_v1";
        const DEFAULT_PANEL_SECTION_ORDER = [
          "update",
          "organize",
          "folders",
          "filters",
          "activity"
        ];
        const FOLDERS_STORAGE_KEY = "vintedFavoritesOrganizer_folders_v1";
        const organizerFolders = /* @__PURE__ */ new Map();
        const folderAssignments = /* @__PURE__ */ new Map();
        function normalizeFolderName(name) {
          return String(
            name || ""
          ).trim().replace(
            /\s+/g,
            " "
          );
        }
        function getNormalizedFolderName(name) {
          return normalizeFolderName(
            name
          ).toLocaleLowerCase(
            "pt-PT"
          );
        }
        function folderNameExists(name, excludedFolderId = null) {
          const normalizedName = getNormalizedFolderName(
            name
          );
          return Array.from(
            organizerFolders.values()
          ).some(
            function(folder) {
              return folder.id !== excludedFolderId && getNormalizedFolderName(
                folder.name
              ) === normalizedName;
            }
          );
        }
        function generateFolderId() {
          if (crypto && typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
          }
          return "folder-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
        }
        function saveOrganizerFoldersToStorage() {
          try {
            const data = {
              version: 1,
              folders: Array.from(
                organizerFolders.values()
              ),
              assignments: Array.from(
                folderAssignments.entries()
              ).map(
                function([
                  listingId,
                  folderIds
                ]) {
                  return [
                    listingId,
                    Array.from(
                      folderIds
                    )
                  ];
                }
              )
            };
            localStorage.setItem(
              FOLDERS_STORAGE_KEY,
              JSON.stringify(
                data
              )
            );
            if (currentView === "dashboard") {
              renderDashboardFolders();
            }
            console.log(
              `Pastas guardadas: ${organizerFolders.size}.`
            );
          } catch (error) {
            console.error(
              "Erro ao guardar pastas:",
              error
            );
          }
        }
        function restoreOrganizerFoldersFromStorage() {
          const savedData = localStorage.getItem(
            FOLDERS_STORAGE_KEY
          );
          if (!savedData) {
            console.log(
              "Nenhuma pasta guardada encontrada."
            );
            return;
          }
          try {
            const data = JSON.parse(
              savedData
            );
            if (!data || !Array.isArray(
              data.folders
            ) || !Array.isArray(
              data.assignments
            )) {
              throw new Error(
                "Formato de pastas inv\xE1lido."
              );
            }
            organizerFolders.clear();
            folderAssignments.clear();
            data.folders.forEach(
              function(folder) {
                if (!folder || !folder.id || !folder.name) {
                  return;
                }
                const id = String(
                  folder.id
                );
                organizerFolders.set(
                  id,
                  {
                    id,
                    name: normalizeFolderName(
                      folder.name
                    ),
                    createdAt: folder.createdAt || null
                  }
                );
              }
            );
            data.assignments.forEach(
              function(entry) {
                if (!Array.isArray(entry) || entry.length !== 2 || !Array.isArray(
                  entry[1]
                )) {
                  return;
                }
                const listingId = String(
                  entry[0]
                );
                const validFolderIds = entry[1].map(
                  function(folderId) {
                    return String(
                      folderId
                    );
                  }
                ).filter(
                  function(folderId) {
                    return organizerFolders.has(
                      folderId
                    );
                  }
                );
                if (validFolderIds.length > 0) {
                  folderAssignments.set(
                    listingId,
                    new Set(
                      validFolderIds
                    )
                  );
                }
              }
            );
            console.log(
              `Pastas restauradas: ${organizerFolders.size}.`
            );
          } catch (error) {
            console.error(
              "Erro ao restaurar pastas:",
              error
            );
          }
        }
        function createOrganizerFolder(name) {
          const cleanName = normalizeFolderName(
            name
          );
          if (!cleanName) {
            throw new Error(
              "O nome da pasta n\xE3o pode estar vazio."
            );
          }
          if (folderNameExists(
            cleanName
          )) {
            throw new Error(
              "J\xE1 existe uma pasta com esse nome."
            );
          }
          const id = generateFolderId();
          const folder = {
            id,
            name: cleanName,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          organizerFolders.set(
            id,
            folder
          );
          saveOrganizerFoldersToStorage();
          return folder;
        }
        function renameOrganizerFolder(folderId, newName) {
          const id = String(
            folderId
          );
          const folder = organizerFolders.get(
            id
          );
          if (!folder) {
            throw new Error(
              "Pasta n\xE3o encontrada."
            );
          }
          const cleanName = normalizeFolderName(
            newName
          );
          if (!cleanName) {
            throw new Error(
              "O nome da pasta n\xE3o pode estar vazio."
            );
          }
          if (folderNameExists(
            cleanName,
            id
          )) {
            throw new Error(
              "J\xE1 existe uma pasta com esse nome."
            );
          }
          folder.name = cleanName;
          saveOrganizerFoldersToStorage();
          return folder;
        }
        function deleteOrganizerFolder(folderId) {
          const id = String(
            folderId
          );
          if (!organizerFolders.has(
            id
          )) {
            return false;
          }
          organizerFolders.delete(
            id
          );
          folderAssignments.forEach(
            function(folderIds, listingId) {
              folderIds.delete(
                id
              );
              if (folderIds.size === 0) {
                folderAssignments.delete(
                  listingId
                );
              }
            }
          );
          saveOrganizerFoldersToStorage();
          return true;
        }
        function addListingToFolder(listingId, folderId) {
          const itemId = String(
            listingId
          );
          const targetFolderId = String(
            folderId
          );
          if (!organizerFolders.has(
            targetFolderId
          )) {
            throw new Error(
              "Pasta n\xE3o encontrada."
            );
          }
          if (!listingCache.has(
            itemId
          )) {
            throw new Error(
              "An\xFAncio n\xE3o encontrado na cache."
            );
          }
          if (!folderAssignments.has(
            itemId
          )) {
            folderAssignments.set(
              itemId,
              /* @__PURE__ */ new Set()
            );
          }
          folderAssignments.get(
            itemId
          ).add(
            targetFolderId
          );
          saveOrganizerFoldersToStorage();
          return true;
        }
        function removeListingFromFolder(listingId, folderId) {
          const itemId = String(
            listingId
          );
          const targetFolderId = String(
            folderId
          );
          const folders = folderAssignments.get(
            itemId
          );
          if (!folders) {
            return false;
          }
          folders.delete(
            targetFolderId
          );
          if (folders.size === 0) {
            folderAssignments.delete(
              itemId
            );
          }
          saveOrganizerFoldersToStorage();
          return true;
        }
        function getFolderIdsForListing(listingId) {
          return Array.from(
            folderAssignments.get(
              String(
                listingId
              )
            ) || []
          );
        }
        function getFoldersForListing(listingId) {
          return getFolderIdsForListing(
            listingId
          ).map(
            function(folderId) {
              return organizerFolders.get(
                folderId
              );
            }
          ).filter(
            Boolean
          );
        }
        function getRecordsForFolder(folderId) {
          const targetFolderId = String(
            folderId
          );
          return Array.from(
            listingCache.values()
          ).filter(
            function(record) {
              const folders = folderAssignments.get(
                String(
                  record.id
                )
              );
              return folders && folders.has(
                targetFolderId
              );
            }
          );
        }
        function getUnfiledFavouriteRecords() {
          return getFavouriteRecords().filter(
            function(record) {
              const folders = folderAssignments.get(
                String(
                  record.id
                )
              );
              return !folders || folders.size === 0;
            }
          );
        }
        function renderFolderList() {
          const container = document.getElementById(
            UI_IDS.folderList
          );
          if (!container) {
            return;
          }
          const favourites = getFavouriteRecords();
          container.innerHTML = "";
          function createFolderRow(id, name, count, isRealFolder = false) {
            const row = document.createElement(
              "div"
            );
            const isActive = currentFolderFilter === id;
            row.style.cssText = `
            display:flex;
            align-items:center;

            min-height:34px;

            border-radius:7px;

            background:
                ${isActive ? "#e5f4f4" : "transparent"};

            border:
                1px solid
                ${isActive ? "#b8dede" : "transparent"};

            transition:
                background 0.12s ease,
                border-color 0.12s ease;
        `;
            const mainButton = document.createElement(
              "button"
            );
            mainButton.type = "button";
            mainButton.style.cssText = `
            flex:1;

            min-width:0;

            display:flex;

            align-items:center;

            justify-content:space-between;

            gap:8px;

            padding:7px 8px;

            border:none;

            background:transparent;

            cursor:pointer;

            color:
                ${isActive ? "#007782" : "#465b5b"};

            font-size:12px;

            font-weight:
                ${isActive ? "700" : "600"};

            text-align:left;
        `;
            const nameElement = document.createElement(
              "span"
            );
            nameElement.textContent = name;
            nameElement.style.cssText = `
            overflow:hidden;

            white-space:nowrap;

            text-overflow:ellipsis;
        `;
            const countElement = document.createElement(
              "span"
            );
            countElement.textContent = count;
            countElement.style.cssText = `
            flex:none;

            min-width:20px;

            padding:2px 6px;

            border-radius:999px;

            background:
                ${isActive ? "#cce8e8" : "#edf2f2"};

            color:
                ${isActive ? "#006d75" : "#718181"};

            font-size:10px;

            text-align:center;
        `;
            mainButton.appendChild(
              nameElement
            );
            mainButton.appendChild(
              countElement
            );
            mainButton.addEventListener(
              "click",
              function() {
                currentFolderFilter = id;
                if (currentView !== "organizer") {
                  setCurrentView(
                    "organizer"
                  );
                }
                renderFolderList();
                populateBrandFilterFromCache();
                renderOrganizerView();
              }
            );
            row.appendChild(
              mainButton
            );
            if (isRealFolder) {
              const actions = document.createElement(
                "div"
              );
              actions.style.cssText = `
                display:flex;

                align-items:center;

                padding-right:4px;

                gap:1px;
            `;
              const renameButton = document.createElement(
                "button"
              );
              renameButton.type = "button";
              renameButton.textContent = "\u270E";
              renameButton.title = "Renomear pasta";
              renameButton.style.cssText = `
                width:25px;
                height:25px;

                padding:0;

                border:none;

                border-radius:5px;

                background:transparent;

                cursor:pointer;

                color:#6d7e7e;

                font-size:12px;
            `;
              renameButton.addEventListener(
                "click",
                function(event) {
                  event.stopPropagation();
                  const folder = organizerFolders.get(
                    id
                  );
                  if (!folder) {
                    return;
                  }
                  mainButton.style.display = "none";
                  actions.style.display = "none";
                  const editor = document.createElement(
                    "div"
                  );
                  editor.style.cssText = `
            display:flex;
            align-items:center;
            gap:4px;

            width:100%;

            padding:4px;
            box-sizing:border-box;
        `;
                  const input = document.createElement(
                    "input"
                  );
                  input.type = "text";
                  input.value = folder.name;
                  input.maxLength = 40;
                  input.style.cssText = `
            flex:1;

            min-width:0;

            padding:6px 7px;

            border:
                1px solid #91c5c8;

            border-radius:6px;

            outline:none;

            background:white;

            color:#253333;

            font-size:12px;

            box-shadow:
                0 0 0 2px
                rgba(0,119,130,0.08);
        `;
                  const saveButton = document.createElement(
                    "button"
                  );
                  saveButton.type = "button";
                  saveButton.textContent = "\u2713";
                  saveButton.title = "Guardar";
                  saveButton.style.cssText = `
            width:28px;
            height:28px;

            flex:none;

            padding:0;

            border:none;

            border-radius:6px;

            background:#007782;

            color:white;

            cursor:pointer;

            font-size:14px;
            font-weight:bold;
        `;
                  const cancelButton = document.createElement(
                    "button"
                  );
                  cancelButton.type = "button";
                  cancelButton.textContent = "\xD7";
                  cancelButton.title = "Cancelar";
                  cancelButton.style.cssText = `
            width:28px;
            height:28px;

            flex:none;

            padding:0;

            border:
                1px solid #d8e1e1;

            border-radius:6px;

            background:#f4f6f6;

            color:#697979;

            cursor:pointer;

            font-size:17px;
        `;
                  editor.appendChild(
                    input
                  );
                  editor.appendChild(
                    saveButton
                  );
                  editor.appendChild(
                    cancelButton
                  );
                  row.appendChild(
                    editor
                  );
                  function cancelRename() {
                    editor.remove();
                    mainButton.style.display = "flex";
                    actions.style.display = "flex";
                  }
                  function saveRename() {
                    const newName = input.value;
                    try {
                      renameOrganizerFolder(
                        id,
                        newName
                      );
                      renderFolderList();
                    } catch (error) {
                      input.focus();
                      input.select();
                    }
                  }
                  saveButton.addEventListener(
                    "click",
                    function(event2) {
                      event2.stopPropagation();
                      saveRename();
                    }
                  );
                  cancelButton.addEventListener(
                    "click",
                    function(event2) {
                      event2.stopPropagation();
                      cancelRename();
                    }
                  );
                  input.addEventListener(
                    "keydown",
                    function(event2) {
                      if (event2.key === "Enter") {
                        event2.preventDefault();
                        saveRename();
                      }
                      if (event2.key === "Escape") {
                        event2.preventDefault();
                        cancelRename();
                      }
                    }
                  );
                  input.addEventListener(
                    "click",
                    function(event2) {
                      event2.stopPropagation();
                    }
                  );
                  input.focus();
                  input.select();
                }
              );
              const deleteButton = document.createElement(
                "button"
              );
              deleteButton.type = "button";
              deleteButton.textContent = "\xD7";
              deleteButton.title = "Apagar pasta";
              deleteButton.style.cssText = `
                width:25px;
                height:25px;

                padding:0;

                border:none;

                border-radius:5px;

                background:transparent;

                cursor:pointer;

                color:#a75a5a;

                font-size:17px;
            `;
              deleteButton.addEventListener(
                "click",
                function(event) {
                  event.stopPropagation();
                  const folder = organizerFolders.get(
                    id
                  );
                  if (!folder) {
                    return;
                  }
                  mainButton.style.display = "none";
                  actions.style.display = "none";
                  const confirmation = document.createElement(
                    "div"
                  );
                  confirmation.style.cssText = `
            width:100%;

            padding:7px 6px;

            box-sizing:border-box;
        `;
                  const message = document.createElement(
                    "div"
                  );
                  message.textContent = `Apagar "${folder.name}"?`;
                  message.style.cssText = `
            margin-bottom:7px;

            color:#7d4141;

            font-size:11px;

            font-weight:600;

            overflow:hidden;

            white-space:nowrap;

            text-overflow:ellipsis;
        `;
                  const buttonRow = document.createElement(
                    "div"
                  );
                  buttonRow.style.cssText = `
            display:flex;

            gap:5px;
        `;
                  const cancelButton = document.createElement(
                    "button"
                  );
                  cancelButton.type = "button";
                  cancelButton.textContent = "Cancelar";
                  cancelButton.style.cssText = `
            flex:1;

            padding:6px 8px;

            border:
                1px solid #d5dfdf;

            border-radius:6px;

            background:#f5f7f7;

            color:#596969;

            cursor:pointer;

            font-size:11px;

            font-weight:600;
        `;
                  const confirmButton = document.createElement(
                    "button"
                  );
                  confirmButton.type = "button";
                  confirmButton.textContent = "Apagar";
                  confirmButton.style.cssText = `
            flex:1;

            padding:6px 8px;

            border:
                1px solid #e3b7b7;

            border-radius:6px;

            background:#fff0f0;

            color:#a12626;

            cursor:pointer;

            font-size:11px;

            font-weight:700;
        `;
                  buttonRow.appendChild(
                    cancelButton
                  );
                  buttonRow.appendChild(
                    confirmButton
                  );
                  confirmation.appendChild(
                    message
                  );
                  confirmation.appendChild(
                    buttonRow
                  );
                  row.appendChild(
                    confirmation
                  );
                  function cancelDelete() {
                    confirmation.remove();
                    mainButton.style.display = "flex";
                    actions.style.display = "flex";
                  }
                  function confirmDelete() {
                    deleteOrganizerFolder(
                      id
                    );
                    if (currentFolderFilter === id) {
                      currentFolderFilter = FOLDER_FILTER_ALL;
                    }
                    renderFolderList();
                    renderOrganizerView();
                  }
                  cancelButton.addEventListener(
                    "click",
                    function(event2) {
                      event2.stopPropagation();
                      cancelDelete();
                    }
                  );
                  confirmButton.addEventListener(
                    "click",
                    function(event2) {
                      event2.stopPropagation();
                      confirmDelete();
                    }
                  );
                  confirmation.addEventListener(
                    "keydown",
                    function(event2) {
                      if (event2.key === "Escape") {
                        event2.preventDefault();
                        cancelDelete();
                      }
                    }
                  );
                  cancelButton.focus();
                }
              );
              actions.appendChild(
                renameButton
              );
              actions.appendChild(
                deleteButton
              );
              row.appendChild(
                actions
              );
            }
            container.appendChild(
              row
            );
          }
          createFolderRow(
            FOLDER_FILTER_ALL,
            "Todos os favoritos",
            favourites.length
          );
          Array.from(
            organizerFolders.values()
          ).sort(
            function(a, b) {
              return a.name.localeCompare(
                b.name,
                "pt-PT"
              );
            }
          ).forEach(
            function(folder) {
              const folderCount = favourites.filter(
                function(record) {
                  const folderIds = folderAssignments.get(
                    String(
                      record.id
                    )
                  );
                  return folderIds && folderIds.has(
                    folder.id
                  );
                }
              ).length;
              createFolderRow(
                folder.id,
                folder.name,
                folderCount,
                true
              );
            }
          );
          createFolderRow(
            FOLDER_FILTER_UNFILED,
            "Sem pasta",
            getUnfiledFavouriteRecords().length
          );
        }
        function createFolderFromInterface() {
          const input = document.getElementById(
            UI_IDS.folderNameInput
          );
          if (!input) {
            return;
          }
          const name = input.value;
          try {
            const folder = createOrganizerFolder(
              name
            );
            input.value = "";
            renderFolderList();
            console.log(
              `Pasta criada: ${folder.name}`
            );
          } catch (error) {
            window.alert(
              error.message
            );
          }
        }
        function saveListingCacheToStorage() {
          try {
            const entries = Array.from(
              listingCache.entries()
            );
            localStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(entries)
            );
            renderPriceHistoryPanel();
            console.log(
              `Cache guardada: ${listingCache.size} an\xFAncios.`
            );
          } catch (error) {
            console.error(
              "Erro ao guardar cache:",
              error
            );
          }
        }
        function restoreListingCacheFromStorage() {
          const savedData = localStorage.getItem(
            STORAGE_KEY
          );
          if (!savedData) {
            console.log(
              "Nenhuma cache guardada encontrada."
            );
            return;
          }
          try {
            const entries = JSON.parse(savedData);
            if (!Array.isArray(entries)) {
              throw new Error(
                "Formato de cache inv\xE1lido."
              );
            }
            listingCache.clear();
            entries.forEach(
              function(entry) {
                if (!Array.isArray(entry) || entry.length !== 2) {
                  return;
                }
                const id = String(entry[0]);
                const record = entry[1];
                if (!record) {
                  return;
                }
                listingCache.set(
                  id,
                  record
                );
              }
            );
            console.log(
              `Cache restaurada: ${listingCache.size} an\xFAncios.`
            );
          } catch (error) {
            console.error(
              "Erro ao restaurar cache:",
              error
            );
          }
        }
        const VINTED_SPECIFIC_TYPES = {
          // Placas gráficas
          "3602": "GPU",
          // CPU e processadores
          "3599": "CPU",
          // RAM
          "3603": "Componente",
          // Armazenamento interno
          "3607": "Componente"
        };
        const VINTED_PARENT_TYPES = {
          // Peças e componentes de computador
          "3582": "Componente",
          // Roupa Homem
          "2050": "Roupa",
          // Roupa Mulher
          "4": "Roupa",
          // Calçado Homem
          "1231": "Roupa",
          // Calçado Mulher
          "16": "Roupa"
        };
        const GPU_PATTERNS = [
          /\brtx\s*\d{3,4}\b/,
          /\b\d{3,4}\s*rtx\b/,
          /\bgtx\s*\d{3,4}\b/,
          /\b\d{3,4}\s*gtx\b/,
          /\brx\s*\d+/,
          /\bradeon\b/,
          /\bgeforce\b/,
          /\bgraphics?\s*card\b/,
          /\bcarte\s+graphique\b/,
          /\bplaca\s+gr[aá]fica\b/,
          /\bgr[aá]fica\b/,
          /\bscheda\s+video\b/,
          /\btarjeta\s+grafica\b/,
          /\b(5500|5600|5700|5800|5900)\s*xt\b/
        ];
        const CPU_PATTERNS = [
          /\bryzen\b/,
          /\bcore\s+i[3579]\b/,
          /\bcore\s+ultra\b/,
          /\bxeon\b/,
          /\bcpu\b/,
          /\bprocessador\b/,
          /\bprocessor\b/
        ];
        const COMPONENT_PATTERNS = [
          /\bram\b/,
          /\bddr[345]\b/,
          /\bmem[oó]ria\b/,
          /\bssd\b/,
          /\bnvme\b/,
          /\bhdd\b/,
          /\bmotherboard\b/,
          /\bplaca[- ]?m[aã]e\b/,
          /\bmainboard\b/,
          /\bpsu\b/,
          /\bfonte\b/,
          /\bpower\s+supply\b/,
          /\bfonte\s+de\s+alimenta[cç][aã]o\b/,
          /\bcooler\b/
        ];
        const CLOTHING_PATTERNS = [
          // Português
          /\bt[- ]?shirt\b/,
          /\bcamisola\b/,
          /\bsweater\b/,
          /\bhoodie\b/,
          /\bsweatshirt\b/,
          /\bcasaco\b/,
          /\bblusão\b/,
          /\bcal[cç]as\b/,
          /\bcal[cç]as de ganga\b/,
          /\bjeans\b/,
          /\bshorts\b/,
          /\bsaia\b/,
          /\bvestido\b/,
          /\bcamisa\b/,
          /\bblusa\b/,
          /\bsapatilhas\b/,
          /\bsapatos\b/,
          /\bbotas\b/,
          /\bsandálias\b/,
          /\bsandalias\b/,
          /\bfato\b/,
          /\bfatos\b/,
          /\bterno\b/,
          /\bblazer\b/,
          /\bcolete\b/,
          /\bsmoking\b/,
          /\bfraque\b/,
          /\bdisfarce\b/,
          /\bdisfarces\b/,
          // Inglês
          /\bt[- ]?shirt\b/,
          /\bshirt\b/,
          /\bsweater\b/,
          /\bhoodie\b/,
          /\bsweatshirt\b/,
          /\bjacket\b/,
          /\bcoat\b/,
          /\btrousers\b/,
          /\bpants\b/,
          /\bjeans\b/,
          /\bshorts\b/,
          /\bskirt\b/,
          /\bdress\b/,
          /\bblouse\b/,
          /\bshoes\b/,
          /\bsneakers\b/,
          /\bboots\b/,
          /\bsuit\b/,
          /\bsuits\b/,
          /\bblazer\b/,
          /\bwaistcoat\b/,
          /\btuxedo\b/,
          /\bcostume\b/,
          // Espanhol
          /\btraje\b/,
          /\btrajes\b/,
          /\bpantal[oó]n\b/,
          /\bpantalones\b/,
          /\bchaqueta\b/,
          /\bamericana\b/,
          /\babrigo\b/,
          /\bcamisa\b/,
          /\bcamiseta\b/,
          /\bsudadera\b/,
          /\bzapatos\b/,
          /\bzapatillas\b/,
          /\bdisfraz\b/,
          /\bdisfraces\b/,
          // Italiano
          /\bcompleto\b/,
          /\bgiacca\b/,
          /\bgilet\b/,
          /\babito\b/,
          /\bpanciotto\b/,
          /\bblazer\b/,
          /\bpantalone\b/,
          /\bpantaloni\b/,
          /\bcamicia\b/,
          /\bmaglia\b/,
          /\bgiubbotto\b/,
          /\bscarpe\b/,
          /\bsneakers\b/,
          /\bstivali\b/,
          /\bvestito\b/,
          /\bgonna\b/,
          /\bshorts\b/,
          /\bcompleto\b/,
          /\bcompleti\b/,
          /\babito\b/,
          /\babiti\b/,
          /\bgiacca\b/,
          /\bpantalone\b/,
          /\bpantaloni\b/,
          /\bcamicia\b/,
          /\bgiubbotto\b/,
          /\bvestito\b/,
          /\bscarpe\b/,
          /\bcostume\b/,
          // Francês
          /\bveste\b/,
          /\bchemise\b/,
          /\bpantalon\b/,
          /\brobe\b/,
          /\bjupe\b/,
          /\bchaussures\b/,
          /\bbaskets\b/,
          /\bbotte\b/,
          /\bblouson\b/,
          /\bcostume\b/,
          /\bpantalon\b/,
          /\bveste\b/,
          /\bchemise\b/,
          /\bmanteau\b/,
          /\bchaussures\b/,
          /\bd[eé]guisement\b/,
          /\bd[eé]guisements\b/,
          // Holandês
          /\bpak\b/,
          /\bpakken\b/,
          /\bherenpak\b/,
          /\bdamespak\b/,
          /\bdriedelig\b/,
          /\btweedelig\b/,
          /\bcolbert\b/,
          /\bblazer\b/,
          /\bpantalon\b/,
          /\bbroek\b/,
          /\boverhemd\b/,
          /\bjas\b/,
          /\bjurk\b/,
          /\bschoenen\b/,
          /\bsneakers\b/,
          /\blaarzen\b/,
          /\bkostuum\b/,
          // Alemão
          /\banzug\b/,
          /\bhose\b/,
          /\bhemd\b/,
          /\bjacke\b/,
          /\bmantel\b/,
          /\bkleid\b/,
          /\bschuhe\b/,
          /\bkost[uü]m\b/,
          // Modelos claramente associados a calçado
          /\bair\s+max\b/,
          /\bair\s+force\b/,
          /\bair\s+jordan\b/,
          /\bshox\b/
        ];
        const CLOTHING_CATEGORY_PATTERNS = [
          /\broupa\b/,
          /\bvestu[aá]rio\b/,
          /\bclothing\b/,
          /\bapparel\b/,
          /\bropa\b/,
          /\babbigliamento\b/,
          /\bv[eê]tements?\b/,
          /\bkleding\b/,
          /\bkleidung\b/,
          /\bfatos?\b/,
          /\bsuits?\b/,
          /\btrajes?\b/,
          /\bdisfarces?\b/,
          /\bdisfraces?\b/,
          /\bd[eé]guisements?\b/,
          /\bcostumes?\b/
        ];
        function getItems() {
          return Array.from(
            document.querySelectorAll(SELECTORS.listing)
          );
        }
        function getApiPrice(apiItem) {
          const price = parseFloat(
            apiItem?.price?.amount
          );
          return Number.isFinite(price) ? price : NaN;
        }
        function getListingId(item) {
          const productElement = item.querySelector(
            '[data-testid^="product-item-id-"]'
          );
          const testId = productElement?.getAttribute(
            "data-testid"
          ) || "";
          const match = testId.match(
            /^product-item-id-(\d+)/
          );
          if (match) {
            return match[1];
          }
          const link = item.querySelector(
            SELECTORS.itemLink
          );
          const href = link?.href || "";
          const urlMatch = href.match(
            /\/items\/(\d+)/
          );
          return urlMatch ? urlMatch[1] : null;
        }
        function getListingUrl(item) {
          const link = item.querySelector(
            SELECTORS.itemLink
          );
          return link?.href || "";
        }
        function updatePriceHistory(record, newPrice, timestamp) {
          if (!Number.isFinite(newPrice)) {
            return;
          }
          if (!Array.isArray(record.priceHistory)) {
            record.priceHistory = [];
            if (Number.isFinite(record.price)) {
              record.priceHistory.push({
                price: record.price,
                date: record.lastSeen || record.firstSeen || timestamp
              });
            }
          }
          const lastEntry = record.priceHistory[record.priceHistory.length - 1];
          if (!lastEntry || lastEntry.price !== newPrice) {
            record.priceHistory.push({
              price: newPrice,
              date: timestamp
            });
            console.log(
              `Pre\xE7o alterado: ${record.name} \u2192 ${newPrice}\u20AC`
            );
          }
          record.price = newPrice;
        }
        function getLastPriceChange(record) {
          const history = record.priceHistory;
          if (!Array.isArray(history) || history.length < 2) {
            return null;
          }
          const previousEntry = history[history.length - 2];
          const currentEntry = history[history.length - 1];
          const previousPrice = previousEntry.price;
          const currentPrice = currentEntry.price;
          const difference = currentPrice - previousPrice;
          if (difference === 0) {
            return null;
          }
          const percentage = previousPrice !== 0 ? difference / previousPrice * 100 : 0;
          return {
            previousPrice,
            currentPrice,
            difference,
            percentage,
            date: currentEntry.date
          };
        }
        function renderPriceHistoryPanel() {
          const container = document.getElementById(
            UI_IDS.priceHistory
          );
          const summary = document.getElementById(
            UI_IDS.priceHistorySummary
          );
          if (!container || !summary) {
            return;
          }
          const changedRecords = getFavouriteRecords().map(function(record) {
            const change = getLastPriceChange(record);
            if (!change) {
              return null;
            }
            return {
              record,
              change
            };
          }).filter(Boolean).sort(function(a, b) {
            return new Date(b.change.date) - new Date(a.change.date);
          });
          const priceDrops = changedRecords.filter(
            function(item) {
              return item.change.difference < 0;
            }
          ).length;
          const priceRises = changedRecords.filter(
            function(item) {
              return item.change.difference > 0;
            }
          ).length;
          summary.textContent = `${changedRecords.length} altera\xE7\xF5es \u2022 \u2193 ${priceDrops} \u2022 \u2191 ${priceRises}`;
          container.innerHTML = "";
          if (changedRecords.length === 0) {
            const emptyMessage = document.createElement("div");
            emptyMessage.textContent = "Ainda n\xE3o foram registadas altera\xE7\xF5es de pre\xE7o.";
            emptyMessage.style.cssText = `
            font-size: 12px;
            color: #777;
            padding: 8px 2px;
        `;
            container.appendChild(
              emptyMessage
            );
            return;
          }
          changedRecords.slice(0, 10).forEach(function(item) {
            const record = item.record;
            const change = item.change;
            const row = document.createElement("a");
            row.href = record.url;
            row.target = "_blank";
            row.rel = "noopener noreferrer";
            row.style.cssText = `
                display:block;
                padding:8px 4px;
                border-bottom:1px solid #eee;
                text-decoration:none;
                color:#222;
            `;
            const name = document.createElement("div");
            name.textContent = record.name;
            name.style.cssText = `
                font-size:12px;
                font-weight:bold;
                white-space:nowrap;
                overflow:hidden;
                text-overflow:ellipsis;
                margin-bottom:4px;
            `;
            const priceLine = document.createElement("div");
            const arrow = change.difference < 0 ? "\u2193" : "\u2191";
            const differenceText = Math.abs(
              change.difference
            ).toFixed(2);
            const percentageText = Math.abs(
              change.percentage
            ).toFixed(1);
            priceLine.textContent = `${change.previousPrice}\u20AC \u2192 ${change.currentPrice}\u20AC  ${arrow} ${differenceText}\u20AC (${percentageText}%)`;
            priceLine.style.cssText = `
                font-size:12px;
            `;
            row.appendChild(
              name
            );
            row.appendChild(
              priceLine
            );
            container.appendChild(
              row
            );
          });
        }
        function syncListingRecord(item) {
          const id = getListingId(item);
          if (!id) {
            console.warn(
              "N\xE3o foi poss\xEDvel obter ID:",
              item
            );
            return null;
          }
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const currentPrice = getPrice(item);
          const existingRecord = listingCache.get(id);
          if (existingRecord) {
            existingRecord.url = getListingUrl(item);
            existingRecord.name = getName(item);
            existingRecord.brand = getBrand(item);
            updatePriceHistory(
              existingRecord,
              currentPrice,
              now
            );
            existingRecord.fallbackType = getFallbackListingType(item);
            if ((!existingRecord.resolvedType || existingRecord.resolvedType === "Outro") && existingRecord.fallbackType !== "Outro") {
              existingRecord.resolvedType = existingRecord.fallbackType;
            }
            existingRecord.lastSeen = now;
            return existingRecord;
          }
          const fallbackType = getFallbackListingType(item);
          const record = {
            id,
            url: getListingUrl(item),
            name: getName(item),
            brand: getBrand(item),
            price: currentPrice,
            priceHistory: Number.isFinite(currentPrice) ? [
              {
                price: currentPrice,
                date: now
              }
            ] : [],
            fallbackType,
            catalogIds: [],
            catalogPath: [],
            vintedCategory: null,
            resolvedType: fallbackType !== "Outro" ? fallbackType : null,
            categoryStatus: "unknown",
            firstSeen: now,
            lastSeen: now
          };
          listingCache.set(
            id,
            record
          );
          return record;
        }
        function syncApiListingRecord(apiItem) {
          const id = String(apiItem.id);
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const currentPrice = getApiPrice(apiItem);
          const fallbackType = getFallbackTypeFromName(
            apiItem.title
          );
          const existingRecord = listingCache.get(id);
          if (existingRecord) {
            existingRecord.isVisible = apiItem.is_visible ?? null;
            existingRecord.isHidden = apiItem.is_hidden ?? null;
            existingRecord.isReserved = apiItem.is_reserved ?? null;
            existingRecord.isClosed = apiItem.is_closed ?? null;
            existingRecord.itemClosingAction = apiItem.item_closing_action ?? null;
            existingRecord.url = apiItem.url || existingRecord.url;
            existingRecord.name = apiItem.title || existingRecord.name;
            existingRecord.brand = apiItem.brand_title || existingRecord.brand || "";
            existingRecord.photoUrl = apiItem.photo?.url || existingRecord.photoUrl || "";
            existingRecord.status = apiItem.status || null;
            existingRecord.favouriteCount = apiItem.favourite_count ?? null;
            existingRecord.isFavourite = true;
            updatePriceHistory(
              existingRecord,
              currentPrice,
              now
            );
            existingRecord.fallbackType = fallbackType;
            if ((!existingRecord.resolvedType || existingRecord.resolvedType === "Outro") && fallbackType !== "Outro") {
              existingRecord.resolvedType = fallbackType;
            }
            existingRecord.lastSeen = now;
            return existingRecord;
          }
          const record = {
            isVisible: apiItem.is_visible ?? null,
            isHidden: apiItem.is_hidden ?? null,
            isReserved: apiItem.is_reserved ?? null,
            isClosed: apiItem.is_closed ?? null,
            itemClosingAction: apiItem.item_closing_action ?? null,
            id,
            photoUrl: apiItem.photo?.url || "",
            url: apiItem.url || "",
            name: apiItem.title || "",
            brand: apiItem.brand_title || "",
            price: currentPrice,
            priceHistory: Number.isFinite(currentPrice) ? [
              {
                price: currentPrice,
                date: now
              }
            ] : [],
            status: apiItem.status || null,
            favouriteCount: apiItem.favourite_count ?? null,
            isFavourite: true,
            fallbackType,
            catalogIds: [],
            catalogPath: [],
            vintedCategory: null,
            resolvedType: fallbackType !== "Outro" ? fallbackType : null,
            categoryStatus: "unknown",
            firstSeen: now,
            lastSeen: now
          };
          listingCache.set(
            id,
            record
          );
          return record;
        }
        function getFavouritesApiUrl() {
          const url = performance.getEntriesByType(
            "resource"
          ).map(function(entry) {
            return entry.name;
          }).find(function(url2) {
            return /\/api\/v2\/users\/\d+\/items\/favourites/.test(url2);
          });
          return url || null;
        }
        async function fetchFavouritePage(baseUrl, page) {
          const url = new URL(baseUrl);
          url.searchParams.set(
            "page",
            String(page)
          );
          const response = await fetch(
            url.toString(),
            {
              headers: {
                "Accept": "application/json"
              },
              credentials: "same-origin"
            }
          );
          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status}`
            );
          }
          const contentType = response.headers.get(
            "content-type"
          ) || "";
          if (!contentType.includes(
            "application/json"
          )) {
            throw new Error(
              "O Vinted n\xE3o devolveu JSON."
            );
          }
          return response.json();
        }
        function isSoldRecord(record) {
          return record.isFavourite === true && record.isClosed === true && record.isVisible === false && record.isReserved !== true && record.itemClosingAction === "sold";
        }
        function getSoldFavouriteRecords() {
          return Array.from(
            listingCache.values()
          ).filter(
            isSoldRecord
          );
        }
        function getRemovedSoldRecords() {
          return Array.from(
            listingCache.values()
          ).filter(
            function(record) {
              return record.removedAsSold === true;
            }
          );
        }
        function updateSoldHistoryButton() {
          const button = document.getElementById(
            UI_IDS.soldHistoryButton
          );
          if (!button) {
            return;
          }
          const count = getRemovedSoldRecords().length;
          button.textContent = `\u{1F558} Hist\xF3rico de vendidos removidos (${count})`;
          button.disabled = count === 0;
          button.style.opacity = count === 0 ? "0.6" : "1";
          button.style.cursor = count === 0 ? "default" : "pointer";
        }
        function updateRemoveSoldButton() {
          const button = document.getElementById(
            UI_IDS.removeSold
          );
          if (!button) {
            return;
          }
          const soldCount = getSoldFavouriteRecords().length;
          if (soldCount === 0) {
            button.textContent = "\u2713 Sem artigos vendidos";
            button.disabled = true;
            button.style.opacity = "0.6";
            button.style.cursor = "default";
            return;
          }
          button.textContent = `\u{1F9F9} Remover vendidos (${soldCount})`;
          button.disabled = false;
          button.style.opacity = "1";
          button.style.cursor = "pointer";
        }
        function getCookieValue(name) {
          const cookies = document.cookie.split("; ");
          const cookie = cookies.find(
            function(entry) {
              return entry.startsWith(
                `${name}=`
              );
            }
          );
          if (!cookie) {
            return null;
          }
          return decodeURIComponent(
            cookie.substring(
              name.length + 1
            )
          );
        }
        function getVintedCsrfToken() {
          return vintedCsrfToken || null;
        }
        async function removeFavouriteViaApi(itemId) {
          const csrfToken = getVintedCsrfToken();
          const anonId = getCookieValue(
            "anon_id"
          );
          if (!csrfToken) {
            throw new Error(
              "CSRF token do Vinted ainda n\xE3o foi capturado."
            );
          }
          if (!anonId) {
            throw new Error(
              "anon_id do Vinted n\xE3o encontrado."
            );
          }
          const response = await originalFetch(
            "/api/v2/user_favourites/toggle",
            {
              method: "POST",
              headers: {
                "Accept": "application/json,text/plain,*/*,image/webp",
                "Content-Type": "application/json",
                "Locale": "pt-PT",
                "X-Anon-Id": anonId,
                "X-Csrf-Token": csrfToken
              },
              credentials: "same-origin",
              body: JSON.stringify({
                type: "item",
                user_favourites: [
                  Number(itemId)
                ]
              })
            }
          );
          if (!response.ok) {
            const responseText = await response.text();
            console.error(
              "Resposta Vinted:",
              response.status,
              responseText
            );
            throw new Error(
              `HTTP ${response.status}`
            );
          }
          const data = await response.json();
          if (data.code !== 0) {
            throw new Error(
              data.message || "Erro desconhecido do Vinted."
            );
          }
          return data;
        }
        let isRemovingSoldListings = false;
        async function removeSoldListings() {
          if (isRemovingSoldListings) {
            return;
          }
          const soldRecords = getSoldFavouriteRecords();
          if (soldRecords.length === 0) {
            updateRemoveSoldButton();
            updateSoldHistoryButton();
            renderFolderList();
            renderSoldHistoryView();
            return;
          }
          const confirmed = window.confirm(
            `Foram encontrados ${soldRecords.length} artigos vendidos.

Queres remov\xEA-los da tua lista de favoritos?

Os dados continuar\xE3o guardados na cache do Organizer.`
          );
          if (!confirmed) {
            return;
          }
          isRemovingSoldListings = true;
          const button = document.getElementById(
            UI_IDS.removeSold
          );
          const status = document.getElementById(
            UI_IDS.removeSoldStatus
          );
          button.disabled = true;
          button.style.opacity = "0.6";
          button.style.cursor = "default";
          let removed = 0;
          let failed = 0;
          const removedIds = /* @__PURE__ */ new Set();
          try {
            for (let index = 0; index < soldRecords.length; index++) {
              const record = soldRecords[index];
              status.textContent = `A remover... ${index + 1}/${soldRecords.length}`;
              try {
                await removeFavouriteViaApi(
                  record.id
                );
                record.isFavourite = false;
                record.removedAsSold = true;
                record.removedAsSoldAt = (/* @__PURE__ */ new Date()).toISOString();
                removedIds.add(
                  record.id
                );
                removed++;
                console.log(
                  `Vendido removido: ${record.name}`
                );
              } catch (error) {
                failed++;
                console.error(
                  `Erro ao remover "${record.name}":`,
                  error
                );
              }
            }
            saveListingCacheToStorage();
            getItems().forEach(
              function(item) {
                const id = getListingId(item);
                if (id && removedIds.has(id)) {
                  item.remove();
                }
              }
            );
            if (currentView === "organizer") {
              populateBrandFilterFromCache();
              renderOrganizerView();
            } else if (currentView === "dashboard") {
              renderDashboard();
            } else {
              populateBrandFilter();
              updateResultsCounter();
            }
            updateRemoveSoldButton();
            if (failed === 0) {
              status.textContent = `\u2713 ${removed} vendidos removidos`;
              status.style.color = "#18794e";
            } else {
              status.textContent = `\u2713 ${removed} removidos \u2022 ${failed} falharam`;
              status.style.color = "#b85f00";
            }
            console.log(
              `Remo\xE7\xE3o terminada: ${removed} removidos, ${failed} falharam.`
            );
          } finally {
            isRemovingSoldListings = false;
            updateRemoveSoldButton();
          }
        }
        function showPriceHistory(id) {
          const record = listingCache.get(
            String(id)
          );
          if (!record) {
            console.log(
              `An\xFAncio ${id} n\xE3o encontrado.`
            );
            return;
          }
          const history = record.priceHistory || [];
          console.log(
            `${record.name} \u2014 pre\xE7o actual: ${record.price}\u20AC`
          );
          console.table(
            history.map(
              function(entry, index) {
                const previous = index > 0 ? history[index - 1].price : null;
                return {
                  data: entry.date,
                  pre\u00E7o: entry.price,
                  altera\u00E7\u00E3o: previous === null ? "-" : (entry.price - previous).toFixed(2) + "\u20AC"
                };
              }
            )
          );
        }
        function syncListingCache() {
          const items = getItems();
          items.forEach(function(item) {
            syncListingRecord(item);
          });
          saveListingCacheToStorage();
          console.log(
            `Cache sincronizada: ${listingCache.size} an\xFAncios.`
          );
          return listingCache;
        }
        function waitForListings() {
          const items = getItems();
          if (items.length > 0) {
            console.log(
              `${items.length} listings encontrados.`
            );
            syncListingCache();
            populateBrandFilter();
            updateResultsCounter();
            return;
          }
          console.log(
            "\xC0 espera dos listings..."
          );
          setTimeout(
            waitForListings,
            500
          );
        }
        function showListingCache() {
          console.table(
            Array.from(
              listingCache.values()
            ).map(function(record) {
              return {
                id: record.id,
                nome: record.name,
                marca: record.brand,
                pre\u00E7o: record.price,
                tipoFallback: record.fallbackType,
                categoriaVinted: record.vintedCategory,
                catalogos: record.catalogIds.join(" \u2192 "),
                tipoResolvido: record.resolvedType,
                estadoCategoria: record.categoryStatus
              };
            })
          );
        }
        window.vintedListingCache = listingCache;
        window.getVintedFavouriteRecords = getFavouriteRecords;
        window.getVintedSoldFavouriteRecords = getSoldFavouriteRecords;
        window.getVintedLastPriceChange = getLastPriceChange;
        window.getVintedDashboardStats = getDashboardStats;
        window.vintedOrganizerFolders = organizerFolders;
        window.vintedFolderAssignments = folderAssignments;
        window.createVintedFolder = createOrganizerFolder;
        window.renameVintedFolder = renameOrganizerFolder;
        window.deleteVintedFolder = deleteOrganizerFolder;
        window.addVintedListingToFolder = addListingToFolder;
        window.removeVintedListingFromFolder = removeListingFromFolder;
        window.getVintedFoldersForListing = getFoldersForListing;
        window.getVintedRecordsForFolder = getRecordsForFolder;
        window.getVintedUnfiledFavourites = getUnfiledFavouriteRecords;
        window.showVintedListingCache = showListingCache;
        window.syncVintedListingCache = syncListingCache;
        window.loadVintedCategories = loadUnknownCategories;
        window.saveVintedListingCache = saveListingCacheToStorage;
        window.restoreVintedListingCache = restoreListingCacheFromStorage;
        window.showVintedPriceHistory = showPriceHistory;
        window.renderVintedPriceHistory = renderPriceHistoryPanel;
        window.reclassifyVintedListings = reclassifyCachedListings;
        window.testRemoveOneSoldFavourite = async function() {
          const record = Array.from(
            listingCache.values()
          ).find(isSoldRecord);
          if (!record) {
            console.log(
              "Nenhum favorito vendido encontrado."
            );
            return;
          }
          console.log(
            `A testar remo\xE7\xE3o de: ${record.name} (${record.id})`
          );
          try {
            const result = await removeFavouriteViaApi(
              record.id
            );
            record.isFavourite = false;
            record.removedAsSold = true;
            record.removedAsSoldAt = (/* @__PURE__ */ new Date()).toISOString();
            saveListingCacheToStorage();
            updateRemoveSoldButton();
            if (currentView === "organizer") {
              renderOrganizerView();
            }
            console.log(
              "SUCESSO:",
              result
            );
            return result;
          } catch (error) {
            console.error(
              "TESTE FALHOU:",
              error
            );
            throw error;
          }
        };
        function getItemTitle(item) {
          const link = item.querySelector(SELECTORS.itemLink);
          return link?.getAttribute("title") || "";
        }
        function getName(item) {
          return getItemTitle(item).split(", marca:")[0].trim();
        }
        function getPrice(item) {
          const priceElement = item.querySelector(SELECTORS.price);
          if (!priceElement) {
            return NaN;
          }
          return parseFloat(
            priceElement.textContent.replace(",", ".").replace(/[^\d.]/g, "")
          );
        }
        function getBrand(item) {
          const brandElement = item.querySelector(SELECTORS.brand);
          if (!brandElement) {
            return "";
          }
          return brandElement.textContent.trim();
        }
        function normalizeText(text) {
          return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        }
        function matchesPatternList(text, patterns) {
          return patterns.some(function(pattern) {
            return pattern.test(text);
          });
        }
        function getFallbackTypeFromName(name) {
          const normalizedName = String(name || "").toLowerCase();
          if (matchesPatternList(
            normalizedName,
            GPU_PATTERNS
          )) {
            return "GPU";
          }
          if (matchesPatternList(
            normalizedName,
            CPU_PATTERNS
          )) {
            return "CPU";
          }
          if (matchesPatternList(
            normalizedName,
            COMPONENT_PATTERNS
          )) {
            return "Componente";
          }
          if (matchesPatternList(
            normalizedName,
            CLOTHING_PATTERNS
          )) {
            return "Roupa";
          }
          return "Outro";
        }
        function getFallbackListingType(item) {
          return getFallbackTypeFromName(
            getName(item)
          );
        }
        function getListingType(item) {
          const id = getListingId(item);
          const record = id ? listingCache.get(id) : null;
          if (record?.resolvedType && record.resolvedType !== "Outro") {
            return record.resolvedType;
          }
          return getFallbackListingType(item);
        }
        function getListingStatus(item) {
          const id = getListingId(
            item
          );
          if (!id) {
            return "";
          }
          const record = listingCache.get(
            String(id)
          );
          return record?.status || "";
        }
        function classifyFromCatalog(catalogIds, catalogPath = [], vintedCategory = "") {
          for (const id of catalogIds) {
            if (VINTED_SPECIFIC_TYPES[id]) {
              return VINTED_SPECIFIC_TYPES[id];
            }
          }
          for (const id of catalogIds) {
            if (VINTED_PARENT_TYPES[id]) {
              return VINTED_PARENT_TYPES[id];
            }
          }
          const categoryText = [
            vintedCategory,
            ...catalogPath.map(
              function(category) {
                return category.name;
              }
            )
          ].filter(Boolean).join(" ").toLowerCase();
          if (matchesPatternList(
            categoryText,
            CLOTHING_CATEGORY_PATTERNS
          )) {
            return "Roupa";
          }
          return null;
        }
        function reclassifyCachedListings() {
          listingCache.forEach(
            function(record) {
              record.fallbackType = getFallbackTypeFromName(
                record.name || ""
              );
              const catalogType = classifyFromCatalog(
                record.catalogIds || [],
                record.catalogPath || [],
                record.vintedCategory || ""
              );
              record.resolvedType = catalogType || record.fallbackType;
            }
          );
          saveListingCacheToStorage();
          if (currentView === "organizer") {
            renderOrganizerView();
          }
          console.log(
            "Classifica\xE7\xE3o da cache actualizada."
          );
        }
        function findProductJsonLd(doc) {
          const scripts = Array.from(
            doc.querySelectorAll(
              'script[type="application/ld+json"]'
            )
          );
          for (const script of scripts) {
            try {
              const data = JSON.parse(
                script.textContent
              );
              if (data && data["@type"] === "Product") {
                return data;
              }
              if (Array.isArray(data)) {
                const product = data.find(function(entry) {
                  return entry && entry["@type"] === "Product";
                });
                if (product) {
                  return product;
                }
              }
            } catch (error) {
              console.warn(
                "JSON-LD inv\xE1lido:",
                error
              );
            }
          }
          return null;
        }
        function extractCatalogPath(doc) {
          const categories = [];
          const seenIds = /* @__PURE__ */ new Set();
          const links = Array.from(
            doc.querySelectorAll(
              'a[href*="/catalog/"]'
            )
          );
          links.forEach(function(link) {
            const href = link.getAttribute("href") || "";
            const match = href.match(
              /\/catalog\/(\d+)/
            );
            if (!match) {
              return;
            }
            const id = match[1];
            const name = link.textContent.trim();
            if (!name || seenIds.has(id)) {
              return;
            }
            seenIds.add(id);
            categories.push({
              id,
              name
            });
          });
          return categories;
        }
        async function loadCategoryForRecord(record) {
          if (!record) {
            return null;
          }
          if (record.categoryStatus === "loaded") {
            return record;
          }
          if (record.categoryStatus === "loading") {
            return record;
          }
          if (!record.url) {
            record.categoryStatus = "error";
            record.categoryError = "URL inexistente";
            return record;
          }
          record.categoryStatus = "loading";
          try {
            const response = await fetch(
              record.url,
              {
                credentials: "same-origin"
              }
            );
            if (!response.ok) {
              throw new Error(
                `HTTP ${response.status}`
              );
            }
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(
              html,
              "text/html"
            );
            const productData = findProductJsonLd(doc);
            record.vintedCategory = productData?.category || null;
            const catalogPath = extractCatalogPath(doc);
            record.catalogPath = catalogPath;
            record.catalogIds = catalogPath.map(
              function(category) {
                return category.id;
              }
            );
            const catalogType = classifyFromCatalog(
              record.catalogIds,
              record.catalogPath,
              record.vintedCategory
            );
            record.resolvedType = catalogType || record.fallbackType;
            record.categoryStatus = "loaded";
            record.categoryLoadedAt = (/* @__PURE__ */ new Date()).toISOString();
            delete record.categoryError;
            saveListingCacheToStorage();
            console.log(
              `Categoria carregada: ${record.name} \u2192 ${record.resolvedType}`
            );
            return record;
          } catch (error) {
            record.categoryStatus = "error";
            record.categoryError = error.message;
            record.resolvedType = record.fallbackType;
            saveListingCacheToStorage();
            console.warn(
              `Erro ao carregar categoria de "${record.name}":`,
              error
            );
            return record;
          }
        }
        let isCategoryLoaderRunning = false;
        function wait(milliseconds) {
          return new Promise(
            function(resolve) {
              setTimeout(
                resolve,
                milliseconds
              );
            }
          );
        }
        async function loadUnknownCategories(limit = Infinity) {
          if (isCategoryLoaderRunning) {
            console.log(
              "Category loader j\xE1 est\xE1 em execu\xE7\xE3o."
            );
            return;
          }
          isCategoryLoaderRunning = true;
          syncListingCache();
          const pendingRecords = Array.from(
            listingCache.values()
          ).filter(function(record) {
            return record.categoryStatus === "unknown";
          }).slice(
            0,
            limit
          );
          console.log(
            `Category loader: ${pendingRecords.length} an\xFAncios por carregar.`
          );
          try {
            for (let index = 0; index < pendingRecords.length; index++) {
              const record = pendingRecords[index];
              console.log(
                `[${index + 1}/${pendingRecords.length}] ${record.name}`
              );
              await loadCategoryForRecord(
                record
              );
              if (index < pendingRecords.length - 1) {
                await wait(1e3);
              }
            }
            console.log(
              "Category loader terminado."
            );
            if (currentView === "organizer") {
              renderOrganizerView();
            } else {
              applyFilters();
            }
            showListingCache();
          } finally {
            isCategoryLoaderRunning = false;
          }
        }
        function matchesTypeFilter(type, selectedType) {
          if (selectedType === "") {
            return true;
          }
          if (type === selectedType) {
            return true;
          }
          if (selectedType === "Componente" && ["GPU", "CPU", "Componente"].includes(type)) {
            return true;
          }
          return false;
        }
        function matchesStatusFilter(status, selectedStatus) {
          if (!selectedStatus) {
            return true;
          }
          return normalizeText(
            status || ""
          ) === normalizeText(
            selectedStatus
          );
        }
        function getSelectedBrands() {
          const brandContainer = document.getElementById(UI_IDS.brandFilter);
          if (!brandContainer) {
            return [];
          }
          return Array.from(
            brandContainer.querySelectorAll(
              'input[type="checkbox"]:checked'
            )
          ).map(function(checkbox) {
            return checkbox.value;
          });
        }
        function getFilterValues() {
          const nameInput = document.getElementById(UI_IDS.nameFilter);
          const minInput = document.getElementById(UI_IDS.priceMin);
          const maxInput = document.getElementById(UI_IDS.priceMax);
          const typeSelect = document.getElementById(UI_IDS.typeFilter);
          const statusSelect = document.getElementById(
            UI_IDS.statusFilter
          );
          return {
            searchName: nameInput.value,
            minPrice: minInput.value === "" ? -Infinity : parseFloat(minInput.value),
            maxPrice: maxInput.value === "" ? Infinity : parseFloat(maxInput.value),
            selectedBrands: getSelectedBrands(),
            selectedType: typeSelect.value,
            selectedStatus: statusSelect ? statusSelect.value : ""
          };
        }
        function matchesNameFilter(name, searchName) {
          if (searchName === "") {
            return true;
          }
          const normalizedName = normalizeText(name);
          const normalizedSearch = normalizeText(searchName);
          return normalizedName.includes(
            normalizedSearch
          );
        }
        function matchesPriceFilter(price, minPrice, maxPrice) {
          return Number.isNaN(price) || price >= minPrice && price <= maxPrice;
        }
        function matchesBrandFilter(brand, selectedBrands) {
          if (selectedBrands.length === 0) {
            return true;
          }
          const normalizedBrand = normalizeText(brand);
          return selectedBrands.some(
            function(selectedBrand) {
              return normalizeText(selectedBrand) === normalizedBrand;
            }
          );
        }
        function getFavouriteRecords() {
          return Array.from(
            listingCache.values()
          ).filter(function(record) {
            return record.isFavourite === true;
          });
        }
        function getRecordType(record) {
          if (record.resolvedType && record.resolvedType !== "Outro") {
            return record.resolvedType;
          }
          return record.fallbackType || record.resolvedType || "Outro";
        }
        function recordMatchesNonBrandFilters(record, filters) {
          const matchesName = matchesNameFilter(
            record.name || "",
            filters.searchName
          );
          const matchesPrice = matchesPriceFilter(
            record.price,
            filters.minPrice,
            filters.maxPrice
          );
          const matchesType = matchesTypeFilter(
            getRecordType(record),
            filters.selectedType
          );
          const matchesStatus = matchesStatusFilter(
            record.status || "",
            filters.selectedStatus
          );
          return matchesName && matchesPrice && matchesType && matchesStatus;
        }
        function recordMatchesFilters(record, filters) {
          if (!recordMatchesNonBrandFilters(
            record,
            filters
          )) {
            return false;
          }
          return matchesBrandFilter(
            record.brand || "",
            filters.selectedBrands
          );
        }
        function recordMatchesFolderFilter(record) {
          if (currentFolderFilter === FOLDER_FILTER_ALL) {
            return true;
          }
          const folderIds = folderAssignments.get(
            String(
              record.id
            )
          );
          if (currentFolderFilter === FOLDER_FILTER_UNFILED) {
            return !folderIds || folderIds.size === 0;
          }
          return folderIds && folderIds.has(
            currentFolderFilter
          );
        }
        function getFilteredOrganizerRecords() {
          const filters = getFilterValues();
          return getFavouriteRecords().filter(
            function(record) {
              return recordMatchesFolderFilter(
                record
              ) && recordMatchesFilters(
                record,
                filters
              );
            }
          );
        }
        function sortOrganizerRecords(records) {
          const sortValue = document.getElementById(
            UI_IDS.sort
          )?.value || "";
          const sorted = [...records];
          switch (sortValue) {
            case "price-asc":
              sorted.sort(function(a, b) {
                return (a.price ?? Infinity) - (b.price ?? Infinity);
              });
              break;
            case "price-desc":
              sorted.sort(function(a, b) {
                return (b.price ?? -Infinity) - (a.price ?? -Infinity);
              });
              break;
            case "name-asc":
              sorted.sort(function(a, b) {
                return normalizeText(
                  a.name || ""
                ).localeCompare(
                  normalizeText(
                    b.name || ""
                  )
                );
              });
              break;
            case "name-desc":
              sorted.sort(function(a, b) {
                return normalizeText(
                  b.name || ""
                ).localeCompare(
                  normalizeText(
                    a.name || ""
                  )
                );
              });
              break;
          }
          return sorted;
        }
        function populateBrandFilterFromCache() {
          const brandContainer = document.getElementById(
            UI_IDS.brandFilter
          );
          if (!brandContainer) {
            return;
          }
          const filters = getFilterValues();
          const selectedBrandSet = new Set(
            filters.selectedBrands.map(
              function(brand) {
                return normalizeText(
                  brand
                );
              }
            )
          );
          const brands = /* @__PURE__ */ new Set();
          getFavouriteRecords().forEach(
            function(record) {
              if (!recordMatchesNonBrandFilters(
                record,
                filters
              )) {
                return;
              }
              if (record.brand) {
                brands.add(
                  record.brand
                );
              }
            }
          );
          const sortedBrands = Array.from(brands).sort(
            function(a, b) {
              return a.localeCompare(b);
            }
          );
          if (sortedBrands.length === 0) {
            return;
          }
          brandContainer.innerHTML = "";
          sortedBrands.forEach(
            function(brand) {
              const label = document.createElement(
                "label"
              );
              label.style.cssText = `
                display:flex;
                align-items:center;
                gap:7px;
                padding:4px 2px;
                font-size:13px;
                cursor:pointer;
            `;
              const checkbox = document.createElement(
                "input"
              );
              checkbox.type = "checkbox";
              checkbox.value = brand;
              checkbox.checked = selectedBrandSet.has(
                normalizeText(
                  brand
                )
              );
              const text = document.createElement(
                "span"
              );
              text.textContent = brand;
              label.appendChild(
                checkbox
              );
              label.appendChild(
                text
              );
              brandContainer.appendChild(
                label
              );
            }
          );
        }
        function matchesNonBrandFilters(item, filters) {
          const name = getName(item);
          const price = getPrice(item);
          const type = getListingType(item);
          const status = getListingStatus(item);
          const matchesName = matchesNameFilter(
            name,
            filters.searchName
          );
          const matchesPrice = matchesPriceFilter(
            price,
            filters.minPrice,
            filters.maxPrice
          );
          const matchesType = matchesTypeFilter(
            type,
            filters.selectedType
          );
          const matchesStatus = matchesStatusFilter(
            status,
            filters.selectedStatus
          );
          return matchesName && matchesPrice && matchesType && matchesStatus;
        }
        function applyFilters() {
          const filters = getFilterValues();
          const items = getItems();
          items.forEach(function(item) {
            const name = getName(item);
            const price = getPrice(item);
            const brand = getBrand(item);
            const type = getListingType(item);
            const status = getListingStatus(item);
            const matchesName = matchesNameFilter(
              name,
              filters.searchName
            );
            const matchesPrice = matchesPriceFilter(
              price,
              filters.minPrice,
              filters.maxPrice
            );
            const matchesBrand = matchesBrandFilter(
              brand,
              filters.selectedBrands
            );
            const matchesType = matchesTypeFilter(
              type,
              filters.selectedType
            );
            const matchesStatus = matchesStatusFilter(
              status,
              filters.selectedStatus
            );
            const shouldShow = matchesName && matchesPrice && matchesBrand && matchesType && matchesStatus;
            item.style.display = shouldShow ? "" : "none";
          });
          populateBrandFilter();
          updateResultsCounter();
          console.log(
            "Filtros aplicados:",
            {
              nome: filters.searchName || "Todos",
              pre\u00E7o: `${filters.minPrice}\u20AC - ${filters.maxPrice}\u20AC`,
              marcas: filters.selectedBrands.length === 0 ? "Todas" : filters.selectedBrands.join(", "),
              tipo: filters.selectedType || "Todos"
            }
          );
        }
        function clearFilters() {
          document.getElementById(
            UI_IDS.nameFilter
          ).value = "";
          document.getElementById(
            UI_IDS.priceMin
          ).value = "";
          document.getElementById(
            UI_IDS.priceMax
          ).value = "";
          document.getElementById(
            UI_IDS.typeFilter
          ).value = "";
          document.getElementById(
            UI_IDS.statusFilter
          ).value = "";
          const brandContainer = document.getElementById(
            UI_IDS.brandFilter
          );
          brandContainer.querySelectorAll(
            'input[type="checkbox"]'
          ).forEach(
            function(checkbox) {
              checkbox.checked = false;
            }
          );
          getItems().forEach(function(item) {
            item.style.display = "";
          });
          populateBrandFilter();
          updateResultsCounter();
          console.log(
            "Todos os filtros foram removidos."
          );
        }
        function populateBrandFilter() {
          const brandContainer = document.getElementById(
            UI_IDS.brandFilter
          );
          if (!brandContainer) {
            console.log(
              "\xC1rea de marcas n\xE3o encontrada."
            );
            return;
          }
          const filters = getFilterValues();
          const currentBrands = filters.selectedBrands;
          const currentBrandSet = new Set(
            currentBrands.map(
              function(brand) {
                return normalizeText(brand);
              }
            )
          );
          const brands = /* @__PURE__ */ new Set();
          getItems().forEach(function(item) {
            if (!matchesNonBrandFilters(
              item,
              filters
            )) {
              return;
            }
            const brand = getBrand(item);
            if (brand) {
              brands.add(brand);
            }
          });
          const sortedBrands = Array.from(brands).sort(
            function(a, b) {
              return a.localeCompare(b);
            }
          );
          if (sortedBrands.length === 0) {
            console.log(
              "Nenhuma marca encontrada. Lista mantida."
            );
            return;
          }
          brandContainer.innerHTML = "";
          sortedBrands.forEach(function(brand) {
            const label = document.createElement("label");
            label.style.cssText = `
                display: flex;
                align-items: center;
                gap: 7px;
                padding: 4px 2px;
                font-size: 13px;
                cursor: pointer;
            `;
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.value = brand;
            checkbox.checked = currentBrandSet.has(
              normalizeText(brand)
            );
            const text = document.createElement("span");
            text.textContent = brand;
            label.appendChild(
              checkbox
            );
            label.appendChild(
              text
            );
            brandContainer.appendChild(
              label
            );
          });
          console.log(
            `Filtro de marcas atualizado: ${sortedBrands.length} marcas encontradas.`
          );
        }
        function populateStatusFilterFromCache() {
          const statusSelect = document.getElementById(
            UI_IDS.statusFilter
          );
          if (!statusSelect) {
            return;
          }
          const currentStatus = statusSelect.value;
          const statuses = /* @__PURE__ */ new Set();
          getFavouriteRecords().forEach(function(record) {
            const status = String(
              record.status || ""
            ).trim();
            if (status) {
              statuses.add(
                status
              );
            }
          });
          const sortedStatuses = Array.from(
            statuses
          ).sort(
            function(a, b) {
              return a.localeCompare(
                b
              );
            }
          );
          statusSelect.innerHTML = "";
          const allOption = document.createElement(
            "option"
          );
          allOption.value = "";
          allOption.textContent = "Todos os estados";
          statusSelect.appendChild(
            allOption
          );
          sortedStatuses.forEach(
            function(status) {
              const option = document.createElement(
                "option"
              );
              option.value = status;
              option.textContent = status;
              statusSelect.appendChild(
                option
              );
            }
          );
          if (sortedStatuses.includes(
            currentStatus
          )) {
            statusSelect.value = currentStatus;
          }
          console.log(
            `Filtro de estados actualizado: ${sortedStatuses.length} estados encontrados.`
          );
        }
        function updateResultsCounter() {
          const counter = document.getElementById(
            UI_IDS.resultCount
          );
          if (!counter) {
            return;
          }
          const items = getItems();
          const visibleItems = items.filter(
            function(item) {
              return item.style.display !== "none";
            }
          );
          counter.textContent = `${visibleItems.length} de ${items.length} favoritos`;
        }
        function sortByPrice(order) {
          const items = getItems();
          if (items.length === 0) {
            console.log(
              "Nenhum listing encontrado."
            );
            return;
          }
          const container = items[0].parentElement;
          items.sort(function(a, b) {
            const priceA = getPrice(a);
            const priceB = getPrice(b);
            if (Number.isNaN(priceA)) {
              return 1;
            }
            if (Number.isNaN(priceB)) {
              return -1;
            }
            return order === "asc" ? priceA - priceB : priceB - priceA;
          });
          items.forEach(function(item) {
            container.appendChild(item);
          });
          console.log(
            order === "asc" ? "Ordenado por pre\xE7o: menor \u2192 maior" : "Ordenado por pre\xE7o: maior \u2192 menor"
          );
        }
        function sortByName(order) {
          const items = getItems();
          if (items.length === 0) {
            console.log(
              "Nenhum listing encontrado."
            );
            return;
          }
          const container = items[0].parentElement;
          items.sort(function(a, b) {
            const nameA = normalizeText(
              getName(a)
            );
            const nameB = normalizeText(
              getName(b)
            );
            return order === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
          });
          items.forEach(function(item) {
            container.appendChild(item);
          });
          console.log(
            order === "asc" ? "Ordenado por nome: A \u2192 Z" : "Ordenado por nome: Z \u2192 A"
          );
        }
        let isLoadingAllListings = false;
        async function loadAllListings() {
          if (isLoadingAllListings) {
            return;
          }
          isLoadingAllListings = true;
          const button = document.getElementById(
            UI_IDS.loadAll
          );
          const status = document.getElementById(
            UI_IDS.loadStatus
          );
          button.disabled = true;
          button.style.cursor = "default";
          button.style.opacity = "0.6";
          status.style.color = "#666";
          try {
            const baseUrl = getFavouritesApiUrl();
            if (!baseUrl) {
              throw new Error(
                "Endpoint dos favoritos n\xE3o encontrado."
              );
            }
            status.textContent = "A sincronizar favoritos...";
            const favouriteIds = /* @__PURE__ */ new Set();
            let page = 1;
            const maxPages = 100;
            while (page <= maxPages) {
              console.log(
                `A carregar favoritos: p\xE1gina ${page}`
              );
              const data = await fetchFavouritePage(
                baseUrl,
                page
              );
              const items = Array.isArray(data.items) ? data.items : [];
              if (items.length === 0) {
                console.log(
                  `P\xE1gina ${page} vazia. Fim dos favoritos.`
                );
                break;
              }
              items.forEach(
                function(apiItem) {
                  const record = syncApiListingRecord(
                    apiItem
                  );
                  if (record) {
                    favouriteIds.add(
                      record.id
                    );
                  }
                }
              );
              status.textContent = `A sincronizar... ${favouriteIds.size} favoritos`;
              console.log(
                `P\xE1gina ${page}: ${items.length} favoritos recebidos. Total: ${favouriteIds.size}`
              );
              page++;
            }
            if (page > maxPages) {
              throw new Error(
                "Limite de seguran\xE7a de p\xE1ginas atingido."
              );
            }
            listingCache.forEach(
              function(record, id) {
                record.isFavourite = favouriteIds.has(id);
              }
            );
            saveListingCacheToStorage();
            populateStatusFilterFromCache();
            updateRemoveSoldButton();
            renderPriceHistoryPanel();
            renderFolderList();
            if (currentView === "organizer") {
              populateBrandFilterFromCache();
              renderOrganizerView();
            } else if (currentView === "dashboard") {
              renderDashboard();
            } else {
              populateBrandFilter();
              updateResultsCounter();
            }
            status.textContent = `\u2713 ${favouriteIds.size} favoritos sincronizados`;
            status.style.color = "#4a7c59";
            console.log(
              `Sincroniza\xE7\xE3o terminada: ${favouriteIds.size} favoritos.`
            );
            return favouriteIds.size;
          } catch (error) {
            console.error(
              "Erro ao sincronizar favoritos:",
              error
            );
            status.textContent = "\u2715 Erro ao sincronizar favoritos";
            status.style.color = "#b00020";
          } finally {
            button.disabled = false;
            button.style.cursor = "pointer";
            button.style.opacity = "1";
            isLoadingAllListings = false;
          }
        }
        function createOrganizerView() {
          if (document.getElementById(
            UI_IDS.organizerView
          )) {
            return;
          }
          const view = document.createElement(
            "div"
          );
          view.id = UI_IDS.organizerView;
          view.style.cssText = `
        position:fixed;
        top:0;
        left:0;
        right:340px;
        bottom:0;

        background:#f3f8f8;

        z-index:99990;

        overflow-y:auto;

        padding:28px;
        box-sizing:border-box;

        display:none;

        font-family:Arial, sans-serif;
    `;
          view.innerHTML = `

        <div style="
    position:sticky;
    top:-28px;

    z-index:20;

    display:flex;
    justify-content:space-between;
    align-items:center;

    margin:-28px -28px 24px -28px;

    padding:20px 28px 14px 28px;

    background:#f3f8f8;

    border-bottom:1px solid #dceaea;
">

            <div>

                <div style="
                    font-size:24px;
                    font-weight:bold;
                    margin-bottom:5px;
                ">
                    Favoritos
                </div>

                <div
                    id="${UI_IDS.organizerViewCount}"
                    style="
                        font-size:13px;
                        color:#666;
                    "
                >
                </div>

            </div>

        </div>


        <div
            id="${UI_IDS.organizerGrid}"
            style="
                display:grid;
                grid-template-columns:
                    repeat(
                        auto-fill,
                        minmax(190px, 1fr)
                    );
                gap:16px;

                align-items:start;
            "
        >
        </div>
    `;
          document.body.appendChild(
            view
          );
        }
        function formatDashboardCurrency(value) {
          if (!Number.isFinite(
            value
          )) {
            return "\u2014";
          }
          return new Intl.NumberFormat(
            "pt-PT",
            {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }
          ).format(
            value
          );
        }
        function getDashboardStats() {
          const favourites = getFavouriteRecords();
          const pricedRecords = favourites.filter(
            function(record) {
              return Number.isFinite(
                record.price
              );
            }
          );
          const totalValue = pricedRecords.reduce(
            function(total, record) {
              return total + record.price;
            },
            0
          );
          const averagePrice = pricedRecords.length > 0 ? totalValue / pricedRecords.length : 0;
          const soldCount = favourites.filter(
            function(record) {
              return isSoldRecord(
                record
              );
            }
          ).length;
          let priceDrops = 0;
          let priceRises = 0;
          favourites.forEach(
            function(record) {
              const change = getLastPriceChange(
                record
              );
              if (!change) {
                return;
              }
              if (change.difference < 0) {
                priceDrops++;
              } else if (change.difference > 0) {
                priceRises++;
              }
            }
          );
          return {
            favouriteCount: favourites.length,
            pricedCount: pricedRecords.length,
            totalValue,
            averagePrice,
            soldCount,
            priceDrops,
            priceRises
          };
        }
        function getDashboardPriceHighlights() {
          const favourites = getFavouriteRecords();
          const changes = favourites.map(
            function(record) {
              const change = getLastPriceChange(
                record
              );
              if (!change) {
                return null;
              }
              return {
                record,
                change
              };
            }
          ).filter(
            Boolean
          );
          const biggestDrop = changes.filter(
            function(item) {
              return item.change.difference < 0;
            }
          ).sort(
            function(a, b) {
              const percentageDifference = a.change.percentage - b.change.percentage;
              if (percentageDifference !== 0) {
                return percentageDifference;
              }
              return a.change.difference - b.change.difference;
            }
          )[0] || null;
          const biggestRise = changes.filter(
            function(item) {
              return item.change.difference > 0;
            }
          ).sort(
            function(a, b) {
              const percentageDifference = b.change.percentage - a.change.percentage;
              if (percentageDifference !== 0) {
                return percentageDifference;
              }
              return b.change.difference - a.change.difference;
            }
          )[0] || null;
          return {
            biggestDrop,
            biggestRise
          };
        }
        function getDashboardGeneralHighlights() {
          const favourites = getFavouriteRecords().filter(
            function(record) {
              return !isSoldRecord(
                record
              );
            }
          );
          const mostPopular = favourites.filter(
            function(record) {
              return Number.isFinite(
                record.favouriteCount
              );
            }
          ).sort(
            function(a, b) {
              return b.favouriteCount - a.favouriteCount;
            }
          )[0] || null;
          const mostExpensive = favourites.filter(
            function(record) {
              return Number.isFinite(
                record.price
              );
            }
          ).sort(
            function(a, b) {
              return b.price - a.price;
            }
          )[0] || null;
          return {
            mostPopular,
            mostExpensive
          };
        }
        function getDashboardRecentActivity() {
          return getFavouriteRecords().map(
            function(record) {
              const change = getLastPriceChange(
                record
              );
              if (!change) {
                return null;
              }
              return {
                record,
                change
              };
            }
          ).filter(
            Boolean
          ).sort(
            function(a, b) {
              return new Date(
                b.change.date
              ) - new Date(
                a.change.date
              );
            }
          ).slice(
            0,
            5
          );
        }
        function getDashboardAttentionStats() {
          const favourites = getFavouriteRecords();
          const sold = favourites.filter(
            function(record) {
              return isSoldRecord(
                record
              );
            }
          );
          const missingPrice = favourites.filter(
            function(record) {
              return !Number.isFinite(
                record.price
              );
            }
          );
          const missingStatus = favourites.filter(
            function(record) {
              return String(
                record.status || ""
              ).trim() === "";
            }
          );
          const genericCategory = favourites.filter(
            function(record) {
              return getRecordType(
                record
              ) === "Outro";
            }
          );
          return {
            soldCount: sold.length,
            missingPriceCount: missingPrice.length,
            missingStatusCount: missingStatus.length,
            genericCategoryCount: genericCategory.length
          };
        }
        function ensureDashboardHighlightsSection() {
          const existing = document.getElementById(
            "vinted-dashboard-highlights"
          );
          if (existing) {
            return existing;
          }
          const dashboardView = document.getElementById(
            UI_IDS.dashboardView
          );
          const distribution = document.getElementById(
            "vinted-dashboard-distribution"
          );
          if (!dashboardView || !distribution) {
            return null;
          }
          const section = document.createElement(
            "div"
          );
          section.id = "vinted-dashboard-highlights-section";
          section.style.cssText = `
        margin-top:28px;
        margin-bottom:28px;
    `;
          section.innerHTML = `

        <div style="
            margin-bottom:12px;

            font-size:12px;

            font-weight:750;

            color:#526b6e;
        ">
            Destaques
        </div>


        <div
            id="vinted-dashboard-highlights"

            style="
                display:grid;

                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(300px, 1fr)
                    );

                gap:14px;

                align-items:start;
            "
        >
        </div>

    `;
          dashboardView.insertBefore(
            section,
            distribution
          );
          return document.getElementById(
            "vinted-dashboard-highlights"
          );
        }
        function ensureDashboardAttentionSection() {
          const existing = document.getElementById(
            "vinted-dashboard-attention"
          );
          if (existing) {
            return existing;
          }
          const dashboardView = document.getElementById(
            UI_IDS.dashboardView
          );
          const distribution = document.getElementById(
            "vinted-dashboard-distribution"
          );
          if (!dashboardView || !distribution) {
            return null;
          }
          const section = document.createElement(
            "div"
          );
          section.id = "vinted-dashboard-attention-section";
          section.style.cssText = `
        margin-bottom:28px;
    `;
          section.innerHTML = `

        <div style="
            display:flex;

            align-items:center;

            gap:7px;

            margin-bottom:12px;

            font-size:12px;

            font-weight:750;

            color:#526b6e;
        ">
            <span>
                \u26A0
            </span>

            <span>
                Aten\xE7\xE3o necess\xE1ria
            </span>
        </div>


        <div style="
            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            padding:14px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.05);
        ">

            <div
                id="vinted-dashboard-attention"

                style="
                    display:grid;

                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(230px, 1fr)
                        );

                    gap:10px;
                "
            >
            </div>

        </div>

    `;
          dashboardView.insertBefore(
            section,
            distribution
          );
          return document.getElementById(
            "vinted-dashboard-attention"
          );
        }
        function renderDashboardAttention() {
          const container = ensureDashboardAttentionSection();
          if (!container) {
            return;
          }
          const stats = getDashboardAttentionStats();
          const section = document.getElementById(
            "vinted-dashboard-attention-section"
          );
          const alerts = [];
          if (stats.soldCount > 0) {
            alerts.push({
              icon: "\u2713",
              title: `${stats.soldCount} ${stats.soldCount === 1 ? "artigo vendido" : "artigos vendidos"}`,
              description: "Ainda presentes nos favoritos",
              accent: "#b24b4b",
              background: "#fff0f0",
              border: "#efc8c8"
            });
          }
          if (stats.missingPriceCount > 0) {
            alerts.push({
              icon: "\u20AC",
              title: `${stats.missingPriceCount} ${stats.missingPriceCount === 1 ? "artigo sem pre\xE7o" : "artigos sem pre\xE7o"}`,
              description: "N\xE3o foi poss\xEDvel determinar o pre\xE7o actual",
              accent: "#b85f00",
              background: "#fff4e5",
              border: "#efd4ad"
            });
          }
          if (stats.missingStatusCount > 0) {
            alerts.push({
              icon: "?",
              title: `${stats.missingStatusCount} ${stats.missingStatusCount === 1 ? "artigo sem estado" : "artigos sem estado"}`,
              description: "Estado de conserva\xE7\xE3o desconhecido",
              accent: "#b85f00",
              background: "#fff4e5",
              border: "#efd4ad"
            });
          }
          if (stats.genericCategoryCount > 0) {
            alerts.push({
              icon: "i",
              title: `${stats.genericCategoryCount} ${stats.genericCategoryCount === 1 ? 'artigo em "Outro"' : 'artigos em "Outro"'}`,
              description: "Classifica\xE7\xE3o gen\xE9rica \u2014 pode valer a pena rever",
              accent: "#597a85",
              background: "#edf5f7",
              border: "#cfdee2"
            });
          }
          if (alerts.length === 0) {
            if (section) {
              section.style.display = "none";
            }
            return;
          }
          if (section) {
            section.style.display = "block";
          }
          container.innerHTML = "";
          alerts.forEach(
            function(alert) {
              const card = document.createElement(
                "div"
              );
              card.style.cssText = `
                display:flex;

                align-items:flex-start;

                gap:11px;

                padding:12px;

                box-sizing:border-box;

                border:
                    1px solid ${alert.border};

                border-radius:10px;

                background:
                    ${alert.background};
            `;
              const icon = document.createElement(
                "div"
              );
              icon.textContent = alert.icon;
              icon.style.cssText = `
                width:28px;
                height:28px;

                flex:none;

                display:flex;

                align-items:center;
                justify-content:center;

                border-radius:8px;

                background:white;

                color:${alert.accent};

                font-size:13px;

                font-weight:800;

                box-shadow:
                    0 1px 3px
                    rgba(0,0,0,0.06);
            `;
              const text = document.createElement(
                "div"
              );
              text.style.cssText = `
                min-width:0;

                flex:1;
            `;
              const title = document.createElement(
                "div"
              );
              title.textContent = alert.title;
              title.style.cssText = `
                margin-bottom:3px;

                font-size:12px;

                font-weight:750;

                color:#314b4f;
            `;
              const description = document.createElement(
                "div"
              );
              description.textContent = alert.description;
              description.style.cssText = `
                font-size:10px;

                line-height:1.4;

                color:#718184;
            `;
              text.appendChild(
                title
              );
              text.appendChild(
                description
              );
              card.appendChild(
                icon
              );
              card.appendChild(
                text
              );
              container.appendChild(
                card
              );
            }
          );
        }
        function ensureDashboardRecentActivitySection() {
          const existing = document.getElementById(
            "vinted-dashboard-recent-activity"
          );
          if (existing) {
            return existing;
          }
          const dashboardView = document.getElementById(
            UI_IDS.dashboardView
          );
          const distribution = document.getElementById(
            "vinted-dashboard-distribution"
          );
          if (!dashboardView || !distribution) {
            return null;
          }
          const section = document.createElement(
            "div"
          );
          section.id = "vinted-dashboard-recent-activity-section";
          section.style.cssText = `
        margin-bottom:28px;
    `;
          section.innerHTML = `

        <div style="
            display:flex;

            justify-content:space-between;

            align-items:center;

            gap:12px;

            margin-bottom:12px;
        ">

            <div style="
                font-size:12px;

                font-weight:750;

                color:#526b6e;
            ">
                Actividade recente
            </div>


            <div style="
                padding:4px 8px;

                border-radius:999px;

                background:#eaf5f5;

                border:
                    1px solid #d2e7e7;

                color:#617779;

                font-size:10px;

                font-weight:700;
            ">
                \xDAltimas 5 altera\xE7\xF5es
            </div>

        </div>


        <div style="
            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            padding:6px 18px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.05);
        ">

            <div
                id="vinted-dashboard-recent-activity"
            >
            </div>

        </div>

    `;
          dashboardView.insertBefore(
            section,
            distribution
          );
          return document.getElementById(
            "vinted-dashboard-recent-activity"
          );
        }
        function renderDashboardRecentActivity() {
          const container = ensureDashboardRecentActivitySection();
          if (!container) {
            return;
          }
          const activity = getDashboardRecentActivity();
          const section = document.getElementById(
            "vinted-dashboard-recent-activity-section"
          );
          if (activity.length === 0) {
            if (section) {
              section.style.display = "none";
            }
            return;
          }
          if (section) {
            section.style.display = "block";
          }
          container.innerHTML = "";
          activity.forEach(
            function(item, index) {
              const record = item.record;
              const change = item.change;
              const isDrop = change.difference < 0;
              const accent = isDrop ? "#2f8f5b" : "#b85f00";
              const softBackground = isDrop ? "#e8f5ee" : "#fff1df";
              const row = record.url ? document.createElement(
                "a"
              ) : document.createElement(
                "div"
              );
              if (record.url) {
                row.href = record.url;
                row.target = "_blank";
                row.rel = "noopener noreferrer";
              }
              row.style.cssText = `
                display:grid;

                grid-template-columns:
                    minmax(180px, 1.6fr)
                    minmax(180px, 1fr)
                    auto
                    auto;

                align-items:center;

                gap:18px;

                padding:
                    13px 0;

                border-bottom:
                    ${index < activity.length - 1 ? "1px solid #edf2f2" : "none"};

                text-decoration:none;

                color:inherit;

                transition:
                    background 0.12s ease;
            `;
              const name = document.createElement(
                "div"
              );
              name.textContent = record.name || "Artigo sem nome";
              name.style.cssText = `
                min-width:0;

                overflow:hidden;

                white-space:nowrap;

                text-overflow:ellipsis;

                font-size:12px;

                font-weight:700;

                color:#29474b;
            `;
              const prices = document.createElement(
                "div"
              );
              prices.textContent = `${formatDashboardCurrency(
                change.previousPrice
              )} \u2192 ${formatDashboardCurrency(
                change.currentPrice
              )}`;
              prices.style.cssText = `
                font-size:12px;

                font-weight:700;

                color:#53676a;

                white-space:nowrap;
            `;
              const variation = document.createElement(
                "div"
              );
              const sign = isDrop ? "\u2212" : "+";
              variation.textContent = `${sign}${Math.abs(
                change.percentage
              ).toFixed(1)}%`;
              variation.style.cssText = `
                min-width:58px;

                padding:5px 7px;

                box-sizing:border-box;

                border-radius:999px;

                background:
                    ${softBackground};

                color:
                    ${accent};

                text-align:center;

                font-size:10px;

                font-weight:750;
            `;
              const date = document.createElement(
                "div"
              );
              const parsedDate = new Date(
                change.date
              );
              date.textContent = Number.isNaN(
                parsedDate.getTime()
              ) ? "\u2014" : parsedDate.toLocaleDateString(
                "pt-PT"
              );
              date.style.cssText = `
                min-width:70px;

                text-align:right;

                font-size:10px;

                color:#879496;
            `;
              row.appendChild(
                name
              );
              row.appendChild(
                prices
              );
              row.appendChild(
                variation
              );
              row.appendChild(
                date
              );
              row.addEventListener(
                "mouseenter",
                function() {
                  row.style.background = "#f8fbfb";
                }
              );
              row.addEventListener(
                "mouseleave",
                function() {
                  row.style.background = "transparent";
                }
              );
              container.appendChild(
                row
              );
            }
          );
        }
        function renderDashboardPriceHighlights() {
          const container = ensureDashboardHighlightsSection();
          if (!container) {
            return;
          }
          const highlights = getDashboardPriceHighlights();
          const generalHighlights = getDashboardGeneralHighlights();
          container.innerHTML = "";
          const section = document.getElementById(
            "vinted-dashboard-highlights-section"
          );
          if (!highlights.biggestDrop && !highlights.biggestRise && !generalHighlights.mostPopular && !generalHighlights.mostExpensive) {
            if (section) {
              section.style.display = "none";
            }
            return;
          }
          if (section) {
            section.style.display = "block";
          }
          function createHighlightCard(item, {
            label,
            icon,
            accent,
            softBackground
          }) {
            if (!item) {
              return;
            }
            const record = item.record;
            const change = item.change;
            const isDrop = change.difference < 0;
            const card = record.url ? document.createElement(
              "a"
            ) : document.createElement(
              "div"
            );
            if (record.url) {
              card.href = record.url;
              card.target = "_blank";
              card.rel = "noopener noreferrer";
            }
            card.style.cssText = `
            position:relative;

            display:block;

            min-width:0;

            padding:18px;

            box-sizing:border-box;

            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.05);

            text-decoration:none;

            color:inherit;

            overflow:hidden;

            transition:
                transform 0.15s ease,
                box-shadow 0.15s ease,
                border-color 0.15s ease;
        `;
            card.addEventListener(
              "mouseenter",
              function() {
                card.style.transform = "translateY(-2px)";
                card.style.boxShadow = "0 7px 18px rgba(0,0,0,0.09)";
                card.style.borderColor = "#c5dddd";
              }
            );
            card.addEventListener(
              "mouseleave",
              function() {
                card.style.transform = "translateY(0)";
                card.style.boxShadow = "0 3px 10px rgba(0,0,0,0.05)";
                card.style.borderColor = "#d8e7e7";
              }
            );
            const accentBar = document.createElement(
              "div"
            );
            accentBar.style.cssText = `
            position:absolute;

            top:0;
            left:0;
            right:0;

            height:4px;

            background:${accent};
        `;
            const header = document.createElement(
              "div"
            );
            header.style.cssText = `
            display:flex;

            align-items:center;

            justify-content:space-between;

            gap:12px;

            margin-bottom:14px;
        `;
            const labelElement = document.createElement(
              "div"
            );
            labelElement.textContent = label;
            labelElement.style.cssText = `
            font-size:12px;

            font-weight:750;

            color:#5c7072;
        `;
            const iconElement = document.createElement(
              "div"
            );
            iconElement.textContent = icon;
            iconElement.style.cssText = `
            width:34px;
            height:34px;

            flex:none;

            display:flex;

            align-items:center;

            justify-content:center;

            border-radius:10px;

            background:${softBackground};

            color:${accent};

            font-size:18px;

            font-weight:800;
        `;
            header.appendChild(
              labelElement
            );
            header.appendChild(
              iconElement
            );
            const name = document.createElement(
              "div"
            );
            name.textContent = record.name || "Artigo sem nome";
            name.style.cssText = `
            margin-bottom:12px;

            overflow:hidden;

            white-space:nowrap;

            text-overflow:ellipsis;

            font-size:15px;

            font-weight:750;

            color:#214b52;
        `;
            const prices = document.createElement(
              "div"
            );
            prices.textContent = `${formatDashboardCurrency(
              change.previousPrice
            )} \u2192 ${formatDashboardCurrency(
              change.currentPrice
            )}`;
            prices.style.cssText = `
            margin-bottom:9px;

            font-size:18px;

            font-weight:800;

            color:#253f43;

            letter-spacing:-0.2px;
        `;
            const variation = document.createElement(
              "div"
            );
            const sign = isDrop ? "\u2212" : "+";
            variation.textContent = `${sign}${formatDashboardCurrency(
              Math.abs(
                change.difference
              )
            )} \xB7 ${sign}${Math.abs(
              change.percentage
            ).toFixed(1)}%`;
            variation.style.cssText = `
            display:inline-flex;

            align-items:center;

            margin-bottom:13px;

            padding:5px 8px;

            border-radius:999px;

            background:${softBackground};

            color:${accent};

            font-size:11px;

            font-weight:750;
        `;
            const footer = document.createElement(
              "div"
            );
            footer.style.cssText = `
            display:flex;

            justify-content:space-between;

            align-items:center;

            gap:12px;

            padding-top:11px;

            border-top:
                1px solid #edf2f2;
        `;
            const date = document.createElement(
              "span"
            );
            const parsedDate = new Date(
              change.date
            );
            date.textContent = Number.isNaN(
              parsedDate.getTime()
            ) ? "" : `Alterado em ${parsedDate.toLocaleDateString(
              "pt-PT"
            )}`;
            date.style.cssText = `
            font-size:10px;

            color:#849294;
        `;
            const open = document.createElement(
              "span"
            );
            open.textContent = record.url ? "Ver an\xFAncio \u2192" : "";
            open.style.cssText = `
            flex:none;

            font-size:11px;

            font-weight:750;

            color:#007782;
        `;
            footer.appendChild(
              date
            );
            footer.appendChild(
              open
            );
            card.appendChild(
              accentBar
            );
            card.appendChild(
              header
            );
            card.appendChild(
              name
            );
            card.appendChild(
              prices
            );
            card.appendChild(
              variation
            );
            card.appendChild(
              footer
            );
            container.appendChild(
              card
            );
          }
          function createGeneralHighlightCard(record, {
            label,
            icon,
            value,
            subtitle,
            accent,
            softBackground
          }) {
            if (!record) {
              return;
            }
            const card = record.url ? document.createElement(
              "a"
            ) : document.createElement(
              "div"
            );
            if (record.url) {
              card.href = record.url;
              card.target = "_blank";
              card.rel = "noopener noreferrer";
            }
            card.style.cssText = `
        position:relative;

        display:block;

        min-width:0;

        min-height:190px;

        padding:18px;

        box-sizing:border-box;

        background:white;

        border:
            1px solid #d8e7e7;

        border-radius:14px;

        box-shadow:
            0 3px 10px
            rgba(0,0,0,0.05);

        text-decoration:none;

        color:inherit;

        overflow:hidden;

        transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            border-color 0.15s ease;
    `;
            card.addEventListener(
              "mouseenter",
              function() {
                card.style.transform = "translateY(-2px)";
                card.style.boxShadow = "0 7px 18px rgba(0,0,0,0.09)";
                card.style.borderColor = "#c5dddd";
              }
            );
            card.addEventListener(
              "mouseleave",
              function() {
                card.style.transform = "translateY(0)";
                card.style.boxShadow = "0 3px 10px rgba(0,0,0,0.05)";
                card.style.borderColor = "#d8e7e7";
              }
            );
            const accentBar = document.createElement(
              "div"
            );
            accentBar.style.cssText = `
        position:absolute;

        top:0;
        left:0;
        right:0;

        height:4px;

        background:${accent};
    `;
            const header = document.createElement(
              "div"
            );
            header.style.cssText = `
        display:flex;

        justify-content:space-between;

        align-items:center;

        gap:12px;

        margin-bottom:14px;
    `;
            const labelElement = document.createElement(
              "div"
            );
            labelElement.textContent = label;
            labelElement.style.cssText = `
        font-size:12px;

        font-weight:750;

        color:#5c7072;
    `;
            const iconElement = document.createElement(
              "div"
            );
            iconElement.textContent = icon;
            iconElement.style.cssText = `
        width:34px;
        height:34px;

        flex:none;

        display:flex;

        align-items:center;
        justify-content:center;

        border-radius:10px;

        background:${softBackground};

        color:${accent};

        font-size:16px;

        font-weight:800;
    `;
            header.appendChild(
              labelElement
            );
            header.appendChild(
              iconElement
            );
            const name = document.createElement(
              "div"
            );
            name.textContent = record.name || "Artigo sem nome";
            name.style.cssText = `
        margin-bottom:11px;

        overflow:hidden;

        white-space:nowrap;

        text-overflow:ellipsis;

        font-size:15px;

        font-weight:750;

        color:#214b52;
    `;
            const valueElement = document.createElement(
              "div"
            );
            valueElement.textContent = value;
            valueElement.style.cssText = `
        margin-bottom:7px;

        font-size:21px;

        font-weight:800;

        line-height:1.1;

        color:#253f43;

        letter-spacing:-0.2px;
    `;
            const subtitleElement = document.createElement(
              "div"
            );
            subtitleElement.textContent = subtitle;
            subtitleElement.style.cssText = `
        margin-bottom:13px;

        font-size:10px;

        line-height:1.4;

        color:#849294;
    `;
            const footer = document.createElement(
              "div"
            );
            footer.style.cssText = `
        display:flex;

        justify-content:flex-end;

        align-items:center;

        padding-top:11px;

        border-top:
            1px solid #edf2f2;
    `;
            const open = document.createElement(
              "span"
            );
            open.textContent = record.url ? "Ver an\xFAncio \u2192" : "";
            open.style.cssText = `
        font-size:11px;

        font-weight:750;

        color:#007782;
    `;
            footer.appendChild(
              open
            );
            card.appendChild(
              accentBar
            );
            card.appendChild(
              header
            );
            card.appendChild(
              name
            );
            card.appendChild(
              valueElement
            );
            card.appendChild(
              subtitleElement
            );
            card.appendChild(
              footer
            );
            container.appendChild(
              card
            );
          }
          createHighlightCard(
            highlights.biggestDrop,
            {
              label: "Maior descida de pre\xE7o",
              icon: "\u2193",
              accent: "#2f8f5b",
              softBackground: "#e8f5ee"
            }
          );
          createHighlightCard(
            highlights.biggestRise,
            {
              label: "Maior subida de pre\xE7o",
              icon: "\u2191",
              accent: "#b85f00",
              softBackground: "#fff1df"
            }
          );
          createGeneralHighlightCard(
            generalHighlights.mostPopular,
            {
              label: "Mais popular",
              icon: "\u2665",
              value: generalHighlights.mostPopular ? `${generalHighlights.mostPopular.favouriteCount} favoritos` : "",
              subtitle: "Artigo guardado por mais utilizadores",
              accent: "#c24f70",
              softBackground: "#fbeaf0"
            }
          );
          createGeneralHighlightCard(
            generalHighlights.mostExpensive,
            {
              label: "Mais caro",
              icon: "\u20AC",
              value: generalHighlights.mostExpensive ? formatDashboardCurrency(
                generalHighlights.mostExpensive.price
              ) : "",
              subtitle: "Maior pre\xE7o anunciado entre os favoritos",
              accent: "#7048a8",
              softBackground: "#f1ebfa"
            }
          );
        }
        function getDashboardCategoryStats() {
          const favourites = getFavouriteRecords();
          const counts = /* @__PURE__ */ new Map();
          favourites.forEach(
            function(record) {
              const type = getRecordType(
                record
              ) || "Outro";
              counts.set(
                type,
                (counts.get(type) || 0) + 1
              );
            }
          );
          return Array.from(
            counts.entries()
          ).map(
            function([
              type,
              count
            ]) {
              return {
                type,
                count,
                percentage: favourites.length > 0 ? count / favourites.length * 100 : 0
              };
            }
          ).sort(
            function(a, b) {
              return b.count - a.count;
            }
          );
        }
        function getDashboardStatusStats() {
          const favourites = getFavouriteRecords();
          const counts = /* @__PURE__ */ new Map();
          favourites.forEach(
            function(record) {
              const status = String(
                record.status || ""
              ).trim() || "Desconhecido";
              counts.set(
                status,
                (counts.get(status) || 0) + 1
              );
            }
          );
          return Array.from(
            counts.entries()
          ).map(
            function([
              status,
              count
            ]) {
              return {
                status,
                count,
                percentage: favourites.length > 0 ? count / favourites.length * 100 : 0
              };
            }
          ).sort(
            function(a, b) {
              return b.count - a.count;
            }
          );
        }
        function getDashboardFolderStats() {
          const favourites = getFavouriteRecords();
          const total = favourites.length;
          const unfiledCount = getUnfiledFavouriteRecords().length;
          const unfiled = {
            id: FOLDER_FILTER_UNFILED,
            name: "Sem pasta",
            count: unfiledCount,
            percentage: total > 0 ? unfiledCount / total * 100 : 0,
            isUnfiled: true
          };
          const folders = Array.from(
            organizerFolders.values()
          ).map(
            function(folder) {
              const count = favourites.filter(
                function(record) {
                  const folderIds = folderAssignments.get(
                    String(
                      record.id
                    )
                  );
                  return folderIds && folderIds.has(
                    folder.id
                  );
                }
              ).length;
              return {
                id: folder.id,
                name: folder.name,
                count,
                percentage: total > 0 ? count / total * 100 : 0,
                isUnfiled: false
              };
            }
          ).sort(
            function(a, b) {
              if (b.count !== a.count) {
                return b.count - a.count;
              }
              return a.name.localeCompare(
                b.name,
                "pt-PT"
              );
            }
          );
          return [
            unfiled,
            ...folders
          ];
        }
        function ensureDashboardFoldersSection() {
          const existingContainer = document.getElementById(
            "vinted-dashboard-folders"
          );
          if (existingContainer) {
            return existingContainer;
          }
          const dashboardView = document.getElementById(
            UI_IDS.dashboardView
          );
          if (!dashboardView) {
            return null;
          }
          const section = document.createElement(
            "div"
          );
          section.id = "vinted-dashboard-folders-section";
          section.style.cssText = `
        margin-top:14px;
    `;
          section.innerHTML = `

        <div style="
            margin-bottom:12px;

            font-size:12px;

            font-weight:750;

            color:#526b6e;
        ">
            Organiza\xE7\xE3o
        </div>


        <div style="
            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            padding:18px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.05);
        ">

            <div style="
                display:flex;

                justify-content:space-between;

                align-items:center;

                gap:16px;

                margin-bottom:18px;
            ">

                <div>

                    <div style="
                        font-size:14px;

                        font-weight:750;

                        color:#214b52;

                        margin-bottom:3px;
                    ">
                        Por pasta
                    </div>


                    <div style="
                        font-size:10px;

                        color:#849294;
                    ">
                        Um favorito pode pertencer a v\xE1rias pastas
                    </div>

                </div>


                <div
                    id="vinted-dashboard-folders-meta"

                    style="
                        flex:none;

                        padding:5px 9px;

                        border-radius:999px;

                        background:#eef7f7;

                        border:
                            1px solid #d3e7e7;

                        color:#607779;

                        font-size:10px;

                        font-weight:700;
                    "
                >
                </div>

            </div>


            <div
                id="vinted-dashboard-folders"
            >
            </div>

        </div>

    `;
          dashboardView.appendChild(
            section
          );
          return document.getElementById(
            "vinted-dashboard-folders"
          );
        }
        function renderDashboardFolders() {
          const container = ensureDashboardFoldersSection();
          if (!container) {
            return;
          }
          const folders = getDashboardFolderStats();
          const meta = document.getElementById(
            "vinted-dashboard-folders-meta"
          );
          const realFolderCount = organizerFolders.size;
          const unfiled = folders.find(
            function(folder) {
              return folder.isUnfiled;
            }
          );
          if (meta) {
            meta.textContent = `${realFolderCount} ${realFolderCount === 1 ? "pasta" : "pastas"} \xB7 ${unfiled ? unfiled.count : 0} sem pasta`;
          }
          container.innerHTML = "";
          folders.forEach(
            function(folder) {
              const color = folder.isUnfiled ? "#879696" : "#007782";
              const row = document.createElement(
                "div"
              );
              row.style.cssText = `
                margin-bottom:16px;
            `;
              const top = document.createElement(
                "div"
              );
              top.style.cssText = `
                display:flex;

                justify-content:space-between;

                align-items:center;

                gap:12px;

                margin-bottom:7px;
            `;
              const name = document.createElement(
                "div"
              );
              name.style.cssText = `
                min-width:0;

                display:flex;

                align-items:center;

                gap:7px;

                overflow:hidden;

                white-space:nowrap;

                text-overflow:ellipsis;

                font-size:12px;

                font-weight:700;

                color:#435a5d;
            `;
              const icon = document.createElement(
                "span"
              );
              icon.textContent = folder.isUnfiled ? "\u25CB" : "\u25B0";
              icon.style.cssText = `
                flex:none;

                color:${color};

                font-size:10px;
            `;
              const nameText = document.createElement(
                "span"
              );
              nameText.textContent = folder.name;
              nameText.style.cssText = `
                overflow:hidden;

                white-space:nowrap;

                text-overflow:ellipsis;
            `;
              name.appendChild(
                icon
              );
              name.appendChild(
                nameText
              );
              const values = document.createElement(
                "div"
              );
              values.textContent = `${folder.count} \xB7 ${folder.percentage.toFixed(1)}%`;
              values.style.cssText = `
                flex:none;

                font-size:11px;

                font-weight:700;

                color:#647779;
            `;
              top.appendChild(
                name
              );
              top.appendChild(
                values
              );
              const track = document.createElement(
                "div"
              );
              track.style.cssText = `
                width:100%;

                height:8px;

                overflow:hidden;

                border-radius:999px;

                background:#edf3f3;
            `;
              const bar = document.createElement(
                "div"
              );
              bar.style.cssText = `
                width:
                    ${folder.percentage}%;

                min-width:
                    ${folder.count > 0 ? "4px" : "0"};

                height:100%;

                border-radius:999px;

                background:${color};

                transition:
                    width 0.25s ease;
            `;
              track.appendChild(
                bar
              );
              row.appendChild(
                top
              );
              row.appendChild(
                track
              );
              container.appendChild(
                row
              );
            }
          );
        }
        function renderDashboardCategories() {
          const container = document.getElementById(
            "vinted-dashboard-categories"
          );
          if (!container) {
            return;
          }
          const categories = getDashboardCategoryStats();
          container.innerHTML = "";
          if (categories.length === 0) {
            container.textContent = "Ainda n\xE3o existem dados suficientes.";
            container.style.cssText = `
            font-size:12px;

            color:#829092;
        `;
            return;
          }
          const categoryColors = {
            GPU: "#007782",
            CPU: "#2457a6",
            Componente: "#7048a8",
            Roupa: "#b85f00",
            Outro: "#7a8989"
          };
          categories.forEach(
            function(category) {
              const color = categoryColors[category.type] || categoryColors.Outro;
              const row = document.createElement(
                "div"
              );
              row.style.cssText = `
                margin-bottom:16px;
            `;
              const top = document.createElement(
                "div"
              );
              top.style.cssText = `
                display:flex;

                justify-content:space-between;

                align-items:center;

                gap:12px;

                margin-bottom:7px;
            `;
              const name = document.createElement(
                "div"
              );
              name.textContent = category.type;
              name.style.cssText = `
                font-size:12px;

                font-weight:700;

                color:#435a5d;
            `;
              const values = document.createElement(
                "div"
              );
              values.textContent = `${category.count} \xB7 ${category.percentage.toFixed(1)}%`;
              values.style.cssText = `
                flex:none;

                font-size:11px;

                font-weight:700;

                color:#647779;
            `;
              top.appendChild(
                name
              );
              top.appendChild(
                values
              );
              const track = document.createElement(
                "div"
              );
              track.style.cssText = `
                position:relative;

                width:100%;

                height:8px;

                overflow:hidden;

                border-radius:999px;

                background:#edf3f3;
            `;
              const bar = document.createElement(
                "div"
              );
              bar.style.cssText = `
                width:
                    ${category.percentage}%;

                min-width:
                    ${category.count > 0 ? "4px" : "0"};

                height:100%;

                border-radius:999px;

                background:${color};

                transition:
                    width 0.25s ease;
            `;
              track.appendChild(
                bar
              );
              row.appendChild(
                top
              );
              row.appendChild(
                track
              );
              container.appendChild(
                row
              );
            }
          );
        }
        function renderDashboardStatuses() {
          const container = document.getElementById(
            "vinted-dashboard-statuses"
          );
          if (!container) {
            return;
          }
          const statuses = getDashboardStatusStats();
          container.innerHTML = "";
          if (statuses.length === 0) {
            container.textContent = "Ainda n\xE3o existem dados suficientes.";
            container.style.cssText = `
            font-size:12px;

            color:#829092;
        `;
            return;
          }
          statuses.forEach(
            function(status, index) {
              const colors = [
                "#007782",
                "#2f8f5b",
                "#4b85a6",
                "#7048a8",
                "#b85f00",
                "#7a8989"
              ];
              const color = colors[index % colors.length];
              const row = document.createElement(
                "div"
              );
              row.style.cssText = `
                margin-bottom:16px;
            `;
              const top = document.createElement(
                "div"
              );
              top.style.cssText = `
                display:flex;

                justify-content:space-between;

                align-items:center;

                gap:12px;

                margin-bottom:7px;
            `;
              const name = document.createElement(
                "div"
              );
              name.textContent = status.status;
              name.style.cssText = `
                min-width:0;

                overflow:hidden;

                white-space:nowrap;

                text-overflow:ellipsis;

                font-size:12px;

                font-weight:700;

                color:#435a5d;
            `;
              const values = document.createElement(
                "div"
              );
              values.textContent = `${status.count} \xB7 ${status.percentage.toFixed(1)}%`;
              values.style.cssText = `
                flex:none;

                font-size:11px;

                font-weight:700;

                color:#647779;
            `;
              top.appendChild(
                name
              );
              top.appendChild(
                values
              );
              const track = document.createElement(
                "div"
              );
              track.style.cssText = `
                position:relative;

                width:100%;

                height:8px;

                overflow:hidden;

                border-radius:999px;

                background:#edf3f3;
            `;
              const bar = document.createElement(
                "div"
              );
              bar.style.cssText = `
                width:
                    ${status.percentage}%;

                min-width:
                    ${status.count > 0 ? "4px" : "0"};

                height:100%;

                border-radius:999px;

                background:${color};

                transition:
                    width 0.25s ease;
            `;
              track.appendChild(
                bar
              );
              row.appendChild(
                top
              );
              row.appendChild(
                track
              );
              container.appendChild(
                row
              );
            }
          );
        }
        function renderDashboard() {
          const container = document.getElementById(
            "vinted-dashboard-kpis"
          );
          if (!container) {
            return;
          }
          const stats = getDashboardStats();
          container.innerHTML = "";
          function createStatCard({
            icon,
            label,
            value,
            subtitle,
            accent,
            softBackground
          }) {
            const card = document.createElement(
              "div"
            );
            card.style.cssText = `
            position:relative;

            min-height:138px;

            padding:16px;

            box-sizing:border-box;

            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.055);

            overflow:hidden;

            transition:
                transform 0.15s ease,
                box-shadow 0.15s ease,
                border-color 0.15s ease;
        `;
            card.addEventListener(
              "mouseenter",
              function() {
                card.style.transform = "translateY(-2px)";
                card.style.boxShadow = "0 7px 18px rgba(0,0,0,0.09)";
                card.style.borderColor = "#c5dddd";
              }
            );
            card.addEventListener(
              "mouseleave",
              function() {
                card.style.transform = "translateY(0)";
                card.style.boxShadow = "0 3px 10px rgba(0,0,0,0.055)";
                card.style.borderColor = "#d8e7e7";
              }
            );
            const accentBar = document.createElement(
              "div"
            );
            accentBar.style.cssText = `
            position:absolute;

            top:0;
            left:0;
            right:0;

            height:4px;

            background:${accent};
        `;
            const top = document.createElement(
              "div"
            );
            top.style.cssText = `
            display:flex;

            align-items:center;

            justify-content:space-between;

            gap:10px;

            margin-bottom:14px;
        `;
            const labelElement = document.createElement(
              "div"
            );
            labelElement.textContent = label;
            labelElement.style.cssText = `
            font-size:12px;

            font-weight:750;

            color:#5b7072;

            line-height:1.25;
        `;
            const iconElement = document.createElement(
              "div"
            );
            iconElement.textContent = icon;
            iconElement.style.cssText = `
            width:34px;
            height:34px;

            flex:none;

            display:flex;

            align-items:center;
            justify-content:center;

            border-radius:10px;

            background:${softBackground};

            color:${accent};

            font-size:16px;

            font-weight:bold;
        `;
            top.appendChild(
              labelElement
            );
            top.appendChild(
              iconElement
            );
            const valueElement = document.createElement(
              "div"
            );
            valueElement.textContent = value;
            valueElement.style.cssText = `
            margin-bottom:8px;

            font-size:27px;

            font-weight:800;

            line-height:1;

            color:#214b52;

            letter-spacing:-0.4px;
        `;
            const subtitleElement = document.createElement(
              "div"
            );
            subtitleElement.textContent = subtitle;
            subtitleElement.style.cssText = `
            font-size:10px;

            line-height:1.4;

            color:#829092;
        `;
            card.appendChild(
              accentBar
            );
            card.appendChild(
              top
            );
            card.appendChild(
              valueElement
            );
            card.appendChild(
              subtitleElement
            );
            container.appendChild(
              card
            );
          }
          createStatCard({
            icon: "\u2665",
            label: "Favoritos",
            value: stats.favouriteCount,
            subtitle: "Artigos actualmente guardados",
            accent: "#007782",
            softBackground: "#e5f4f4"
          });
          createStatCard({
            icon: "\u20AC",
            label: "Valor anunciado",
            value: formatDashboardCurrency(
              stats.totalValue
            ),
            subtitle: `${stats.pricedCount} favoritos com pre\xE7o conhecido`,
            accent: "#007782",
            softBackground: "#e5f4f4"
          });
          createStatCard({
            icon: "\xD8",
            label: "Pre\xE7o m\xE9dio anunciado",
            value: formatDashboardCurrency(
              stats.averagePrice
            ),
            subtitle: "M\xE9dia dos artigos com pre\xE7o v\xE1lido",
            accent: "#007782",
            softBackground: "#e5f4f4"
          });
          createStatCard({
            icon: "\u2713",
            label: "Vendidos",
            value: stats.soldCount,
            subtitle: "Vendidos ainda presentes nos favoritos",
            accent: "#2f8f5b",
            softBackground: "#e8f5ee"
          });
          createStatCard({
            icon: "\u2193",
            label: "Pre\xE7o baixou",
            value: stats.priceDrops,
            subtitle: "Favoritos com descida de pre\xE7o registada",
            accent: "#2f8f5b",
            softBackground: "#e8f5ee"
          });
          createStatCard({
            icon: "\u2191",
            label: "Pre\xE7o subiu",
            value: stats.priceRises,
            subtitle: "Favoritos com subida de pre\xE7o registada",
            accent: "#b85f00",
            softBackground: "#fff1df"
          });
          renderDashboardPriceHighlights();
          renderDashboardAttention();
          renderDashboardRecentActivity();
          renderDashboardCategories();
          renderDashboardStatuses();
          renderDashboardFolders();
        }
        function createDashboardView() {
          if (document.getElementById(
            UI_IDS.dashboardView
          )) {
            return;
          }
          const view = document.createElement(
            "div"
          );
          view.id = UI_IDS.dashboardView;
          view.style.cssText = `
        position:fixed;

        top:90px;
        left:0;
        right:340px;
        bottom:0;

        background:#f3f8f8;

        z-index:99990;

        overflow-y:auto;

        padding:28px;

        box-sizing:border-box;

        display:none;

        font-family:
            Arial,
            sans-serif;

        color:#253333;
    `;
          view.innerHTML = `

    <!-- ================================================== -->
    <!-- CABE\xC7ALHO                                          -->
    <!-- ================================================== -->

    <div style="
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap:20px;

        margin-bottom:26px;

        padding-bottom:18px;

        border-bottom:
            1px solid #dceaea;
    ">

        <div>

            <div style="
                display:inline-flex;
                align-items:center;
                gap:6px;

                margin-bottom:7px;

                padding:5px 9px;

                border-radius:999px;

                background:#e5f4f4;

                border:
                    1px solid #c7e3e3;

                color:#007782;

                font-size:10px;

                font-weight:750;

                letter-spacing:0.2px;
            ">
                VIS\xC3O GERAL
            </div>


            <div style="
                font-size:27px;

                font-weight:800;

                line-height:1.1;

                color:#214b52;

                margin-bottom:6px;
            ">
                Dashboard
            </div>


            <div style="
                font-size:13px;

                color:#687b7d;
            ">
                Resumo dos teus favoritos e actividade recente
            </div>

        </div>

    </div>


    <!-- ================================================== -->
    <!-- RESUMO                                             -->
    <!-- ================================================== -->

    <div style="
        margin-bottom:10px;

        font-size:12px;

        font-weight:750;

        color:#526b6e;
    ">
        Resumo
    </div>


    <div
        id="vinted-dashboard-kpis"

        style="
            display:grid;

            grid-template-columns:
                repeat(
                    auto-fit,
                    minmax(210px, 1fr)
                );

            gap:14px;

            align-items:stretch;
        "
    >
    </div>

    <!-- ================================================== -->
<!-- DISTRIBUI\xC7\xC3O                                       -->
<!-- ================================================== -->

<div
    id="vinted-dashboard-distribution"
    style="
        margin-top:28px;
    "
>

    <div style="
        margin-bottom:12px;

        font-size:12px;

        font-weight:750;

        color:#526b6e;
    ">
        Distribui\xE7\xE3o dos favoritos
    </div>


    <div style="
        display:grid;

        grid-template-columns:
            repeat(
                auto-fit,
                minmax(360px, 1fr)
            );

        gap:14px;

        align-items:start;
    ">

        <!-- ========================================== -->
        <!-- CATEGORIAS                                 -->
        <!-- ========================================== -->

        <div style="
            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            padding:18px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.05);
        ">

            <div style="
                margin-bottom:18px;
            ">

                <div style="
                    font-size:14px;

                    font-weight:750;

                    color:#214b52;

                    margin-bottom:3px;
                ">
                    Por categoria
                </div>


                <div style="
                    font-size:10px;

                    color:#849294;
                ">
                    Distribui\xE7\xE3o dos favoritos activos
                </div>

            </div>


            <div
                id="vinted-dashboard-categories"
            >
            </div>

        </div>


        <!-- ========================================== -->
        <!-- ESTADOS                                    -->
        <!-- ========================================== -->

        <div style="
            background:white;

            border:
                1px solid #d8e7e7;

            border-radius:14px;

            padding:18px;

            box-shadow:
                0 3px 10px
                rgba(0,0,0,0.05);
        ">

            <div style="
                margin-bottom:18px;
            ">

                <div style="
                    font-size:14px;

                    font-weight:750;

                    color:#214b52;

                    margin-bottom:3px;
                ">
                    Por estado
                </div>


                <div style="
                    font-size:10px;

                    color:#849294;
                ">
                    Estado de conserva\xE7\xE3o dos favoritos activos
                </div>

            </div>


            <div
                id="vinted-dashboard-statuses"
            >
            </div>

        </div>

    </div>

</div>

`;
          document.body.appendChild(
            view
          );
        }
        function createSoldHistoryView() {
          if (document.getElementById(
            UI_IDS.soldHistoryView
          )) {
            return;
          }
          const view = document.createElement(
            "div"
          );
          view.id = UI_IDS.soldHistoryView;
          view.style.cssText = `
    position:fixed;

    top:90px;
    left:0;
    right:340px;
    bottom:0;

    background:#f3f8f8;

    z-index:99991;

    overflow-y:auto;

    padding:20px 28px 28px 28px;

    box-sizing:border-box;

    display:none;

    font-family:Arial, sans-serif;
`;
          view.innerHTML = view.innerHTML = `

    <!-- ============================================== -->
    <!-- CABE\xC7ALHO                                     -->
    <!-- ============================================== -->

    <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:20px;

        margin-bottom:22px;

        padding-bottom:16px;

        border-bottom:1px solid #dceaea;
    ">

        <!-- LADO ESQUERDO -->

        <div style="
            display:flex;
            align-items:center;
            gap:12px;
            min-width:0;
        ">

            <div style="
                width:40px;
                height:40px;

                flex:none;

                display:flex;
                align-items:center;
                justify-content:center;

                border-radius:11px;

                background:#e8f6f6;

                border:1px solid #c6e3e3;

                font-size:18px;
            ">
                \u{1F558}
            </div>


            <div style="
                min-width:0;
            ">

                <div style="
                    font-size:22px;

                    font-weight:800;

                    line-height:1.15;

                    color:#214b52;

                    margin-bottom:5px;
                ">
                    Vendidos removidos
                </div>


                <div
                    id="${UI_IDS.soldHistoryCount}"

                    style="
                        font-size:12px;

                        color:#617779;

                        font-weight:600;
                    "
                >
                </div>

            </div>

        </div>


        <!-- BOT\xC3O VOLTAR -->

        <button
            id="${UI_IDS.soldHistoryClose}"

            style="
                flex:none;

                display:flex;
                align-items:center;
                justify-content:center;
                gap:5px;

                padding:8px 12px;

                border:1px solid #b8dede;

                border-radius:7px;

                background:#eaf6f6;

                color:#007782;

                cursor:pointer;

                font-size:12px;

                font-weight:700;
            "
        >
            \u2190 Voltar aos favoritos
        </button>

    </div>


    <!-- ============================================== -->
    <!-- GRELHA DE VENDIDOS                            -->
    <!-- ============================================== -->

    <div
        id="${UI_IDS.soldHistoryGrid}"

        style="
            display:grid;

            grid-template-columns:
                repeat(
                    auto-fill,
                    minmax(190px, 1fr)
                );

            gap:16px;

            align-items:start;
        "
    >
    </div>

`;
          document.body.appendChild(
            view
          );
        }
        function renderSoldHistoryView() {
          const grid = document.getElementById(
            UI_IDS.soldHistoryGrid
          );
          const count = document.getElementById(
            UI_IDS.soldHistoryCount
          );
          if (!grid || !count) {
            return;
          }
          const records = getRemovedSoldRecords().sort(
            function(a, b) {
              return new Date(
                b.removedAsSoldAt || 0
              ) - new Date(
                a.removedAsSoldAt || 0
              );
            }
          );
          count.textContent = `${records.length} artigos vendidos removidos`;
          grid.innerHTML = "";
          if (records.length === 0) {
            grid.innerHTML = `
            <div style="
                font-size:14px;
                color:#666;
            ">
                Ainda n\xE3o existem artigos vendidos
                no hist\xF3rico.
            </div>
        `;
            return;
          }
          records.forEach(
            function(record) {
              grid.appendChild(
                createOrganizerCard(
                  record
                )
              );
            }
          );
        }
        function openSoldHistoryView() {
          renderSoldHistoryView();
          const view = document.getElementById(
            UI_IDS.soldHistoryView
          );
          if (view) {
            view.style.display = "block";
            view.scrollTop = 0;
          }
        }
        function closeSoldHistoryView() {
          const view = document.getElementById(
            UI_IDS.soldHistoryView
          );
          if (view) {
            view.style.display = "none";
          }
          setCurrentView(
            "organizer"
          );
        }
        function getFolderCountForListing(listingId) {
          return getFolderIdsForListing(
            listingId
          ).length;
        }
        function updateCardFolderButton(button, listingId) {
          const count = getFolderCountForListing(
            listingId
          );
          if (count > 0) {
            button.textContent = `\u{1F4C1} ${count}`;
            button.style.background = "#007782";
            button.style.color = "white";
            button.style.borderColor = "#007782";
          } else {
            button.textContent = "\u{1F4C1}";
            button.style.background = "rgba(255,255,255,0.94)";
            button.style.color = "#007782";
            button.style.borderColor = "#b9dcdc";
          }
          button.title = count > 0 ? `${count} pasta${count === 1 ? "" : "s"}` : "Adicionar a uma pasta";
        }
        function closeActiveFolderMenu() {
          if (activeFolderMenu) {
            activeFolderMenu.remove();
            activeFolderMenu = null;
          }
          if (activeFolderMenuCleanup) {
            activeFolderMenuCleanup();
            activeFolderMenuCleanup = null;
          }
        }
        function openFolderMenu(record, button) {
          closeActiveFolderMenu();
          const menu = document.createElement(
            "div"
          );
          activeFolderMenu = menu;
          menu.style.cssText = `
        position:fixed;

        width:230px;

        max-height:320px;

        overflow-y:auto;

        padding:10px;

        box-sizing:border-box;

        background:white;

        border:
            1px solid #cfe0e0;

        border-radius:10px;

        box-shadow:
            0 10px 28px
            rgba(0,0,0,0.18);

        z-index:100001;

        font-family:
            Arial,
            sans-serif;

        color:#253333;
    `;
          const title = document.createElement(
            "div"
          );
          title.textContent = "Adicionar a pastas";
          title.style.cssText = `
        margin-bottom:9px;

        font-size:12px;

        font-weight:700;

        color:#007782;
    `;
          menu.appendChild(
            title
          );
          const folderList = document.createElement(
            "div"
          );
          folderList.style.cssText = `
        display:flex;

        flex-direction:column;

        gap:3px;

        margin-bottom:9px;
    `;
          function renderMenuFolders() {
            folderList.innerHTML = "";
            const folders = Array.from(
              organizerFolders.values()
            ).sort(
              function(a, b) {
                return a.name.localeCompare(
                  b.name,
                  "pt-PT"
                );
              }
            );
            if (folders.length === 0) {
              const empty = document.createElement(
                "div"
              );
              empty.textContent = "Ainda n\xE3o existem pastas.";
              empty.style.cssText = `
                padding:7px 4px;

                color:#7b8989;

                font-size:11px;
            `;
              folderList.appendChild(
                empty
              );
              return;
            }
            const assignedFolderIds = new Set(
              getFolderIdsForListing(
                record.id
              )
            );
            folders.forEach(
              function(folder) {
                const label = document.createElement(
                  "label"
                );
                label.style.cssText = `
                    display:flex;

                    align-items:center;

                    gap:8px;

                    padding:7px 6px;

                    border-radius:6px;

                    cursor:pointer;

                    font-size:12px;

                    transition:
                        background 0.12s ease;
                `;
                label.addEventListener(
                  "mouseenter",
                  function() {
                    label.style.background = "#f1f8f8";
                  }
                );
                label.addEventListener(
                  "mouseleave",
                  function() {
                    label.style.background = "transparent";
                  }
                );
                const checkbox = document.createElement(
                  "input"
                );
                checkbox.type = "checkbox";
                checkbox.checked = assignedFolderIds.has(
                  folder.id
                );
                const folderName = document.createElement(
                  "span"
                );
                folderName.textContent = folder.name;
                folderName.style.cssText = `
                    flex:1;

                    min-width:0;

                    overflow:hidden;

                    white-space:nowrap;

                    text-overflow:ellipsis;
                `;
                checkbox.addEventListener(
                  "change",
                  function() {
                    if (checkbox.checked) {
                      addListingToFolder(
                        record.id,
                        folder.id
                      );
                    } else {
                      removeListingFromFolder(
                        record.id,
                        folder.id
                      );
                    }
                    updateCardFolderButton(
                      button,
                      record.id
                    );
                    renderFolderList();
                    if (currentFolderFilter !== FOLDER_FILTER_ALL) {
                      closeActiveFolderMenu();
                      renderOrganizerView();
                    }
                  }
                );
                label.appendChild(
                  checkbox
                );
                label.appendChild(
                  folderName
                );
                folderList.appendChild(
                  label
                );
              }
            );
          }
          renderMenuFolders();
          menu.appendChild(
            folderList
          );
          const separator = document.createElement(
            "div"
          );
          separator.style.cssText = `
        height:1px;

        margin:
            3px 0 9px 0;

        background:#e8eeee;
    `;
          menu.appendChild(
            separator
          );
          const createRow = document.createElement(
            "div"
          );
          createRow.style.cssText = `
        display:flex;

        gap:5px;
    `;
          const input = document.createElement(
            "input"
          );
          input.type = "text";
          input.maxLength = 40;
          input.placeholder = "Nova pasta...";
          input.style.cssText = `
        flex:1;

        min-width:0;

        padding:7px 8px;

        border:
            1px solid #ccdada;

        border-radius:6px;

        outline:none;

        box-sizing:border-box;

        font-size:11px;
    `;
          const createButton = document.createElement(
            "button"
          );
          createButton.type = "button";
          createButton.textContent = "+";
          createButton.title = "Criar pasta";
          createButton.style.cssText = `
        width:31px;

        flex:none;

        border:none;

        border-radius:6px;

        background:#007782;

        color:white;

        cursor:pointer;

        font-size:17px;

        font-weight:bold;
    `;
          function createAndAssignFolder() {
            const name = input.value;
            try {
              const folder = createOrganizerFolder(
                name
              );
              addListingToFolder(
                record.id,
                folder.id
              );
              input.value = "";
              updateCardFolderButton(
                button,
                record.id
              );
              renderFolderList();
              renderMenuFolders();
            } catch (error) {
              input.focus();
              input.select();
            }
          }
          createButton.addEventListener(
            "click",
            function(event) {
              event.preventDefault();
              event.stopPropagation();
              createAndAssignFolder();
            }
          );
          input.addEventListener(
            "keydown",
            function(event) {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                createAndAssignFolder();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeActiveFolderMenu();
              }
            }
          );
          input.addEventListener(
            "click",
            function(event) {
              event.preventDefault();
              event.stopPropagation();
            }
          );
          createRow.appendChild(
            input
          );
          createRow.appendChild(
            createButton
          );
          menu.appendChild(
            createRow
          );
          document.body.appendChild(
            menu
          );
          const buttonRect = button.getBoundingClientRect();
          const menuRect = menu.getBoundingClientRect();
          let left = buttonRect.right - menuRect.width;
          let top = buttonRect.bottom + 6;
          if (left < 8) {
            left = 8;
          }
          if (left + menuRect.width > window.innerWidth - 8) {
            left = window.innerWidth - menuRect.width - 8;
          }
          if (top + menuRect.height > window.innerHeight - 8) {
            top = buttonRect.top - menuRect.height - 6;
          }
          menu.style.left = `${left}px`;
          menu.style.top = `${Math.max(8, top)}px`;
          function handleOutsideClick(event) {
            if (menu.contains(
              event.target
            ) || button.contains(
              event.target
            )) {
              return;
            }
            closeActiveFolderMenu();
          }
          function handleEscape(event) {
            if (event.key === "Escape") {
              closeActiveFolderMenu();
            }
          }
          function handleScroll() {
            closeActiveFolderMenu();
          }
          setTimeout(
            function() {
              document.addEventListener(
                "click",
                handleOutsideClick
              );
              document.addEventListener(
                "keydown",
                handleEscape
              );
              window.addEventListener(
                "scroll",
                handleScroll,
                true
              );
              activeFolderMenuCleanup = function() {
                document.removeEventListener(
                  "click",
                  handleOutsideClick
                );
                document.removeEventListener(
                  "keydown",
                  handleEscape
                );
                window.removeEventListener(
                  "scroll",
                  handleScroll,
                  true
                );
              };
            },
            0
          );
        }
        const removingFavouriteIds = /* @__PURE__ */ new Set();
        async function toggleFavouriteFromOrganizer(record, heartButton) {
          const id = String(
            record.id
          );
          if (removingFavouriteIds.has(
            id
          )) {
            return;
          }
          removingFavouriteIds.add(
            id
          );
          heartButton.disabled = true;
          heartButton.style.opacity = "0.45";
          heartButton.style.cursor = "wait";
          try {
            await removeFavouriteViaApi(
              record.id
            );
            record.isFavourite = !record.isFavourite;
            saveListingCacheToStorage();
            updateOrganizerHeart(
              heartButton,
              record
            );
            renderFolderList();
            console.log(
              record.isFavourite ? `Favorito novamente adicionado: ${record.name}` : `Favorito removido: ${record.name}`
            );
          } catch (error) {
            console.error(
              `Erro ao alterar favorito "${record.name}":`,
              error
            );
            heartButton.title = "Erro ao alterar favorito. Tenta novamente.";
          } finally {
            removingFavouriteIds.delete(
              id
            );
            heartButton.disabled = false;
            heartButton.style.opacity = "1";
            heartButton.style.cursor = "pointer";
          }
        }
        function updateOrganizerHeart(heartButton, record) {
          if (record.isFavourite === true) {
            heartButton.textContent = "\u2665";
            heartButton.style.color = "#e5484d";
            heartButton.style.background = "transparent";
            heartButton.title = "Remover dos favoritos";
          } else {
            heartButton.textContent = "\u2661";
            heartButton.style.color = "#7b8989";
            heartButton.style.background = "#f3f5f5";
            heartButton.title = "Voltar a adicionar aos favoritos";
          }
        }
        function createOrganizerCard(record) {
          const theme = getTypeTheme(record);
          const isRemovedSold = record.removedAsSold === true;
          const isCurrentlySold = isSoldRecord(
            record
          );
          const card = document.createElement(
            "a"
          );
          card.href = record.url || "#";
          card.target = "_blank";
          card.rel = "noopener noreferrer";
          card.style.cssText = `
        display:block;

        background:
    ${isRemovedSold ? "#f8f8f8" : "white"};

        border-radius:12px;

        overflow:hidden;

        border:
    1px solid
    ${isRemovedSold ? "#d4d4d4" : theme.border};

        box-shadow:
            0 2px 7px rgba(0,0,0,0.10);

        text-decoration:none;

        color:#222;

        transition:
            transform 0.16s ease,
            box-shadow 0.16s ease;

        position:relative;
    `;
          card.addEventListener(
            "mouseenter",
            function() {
              card.style.transform = "translateY(-3px)";
              card.style.boxShadow = "0 8px 18px rgba(0,0,0,0.16)";
            }
          );
          card.addEventListener(
            "mouseleave",
            function() {
              card.style.transform = "translateY(0)";
              card.style.boxShadow = "0 2px 7px rgba(0,0,0,0.10)";
            }
          );
          const imageContainer = document.createElement(
            "div"
          );
          imageContainer.style.cssText = `
        width:100%;
        aspect-ratio:1 / 1;

        background:#eef2f2;

        overflow:hidden;

        position:relative;
    `;
          if (record.photoUrl) {
            const image = document.createElement(
              "img"
            );
            image.src = record.photoUrl;
            image.alt = record.name || "Favorito";
            image.loading = "lazy";
            image.style.cssText = `
            width:100%;
            height:100%;

            object-fit:cover;

            display:block;
        `;
            if (isRemovedSold) {
              image.style.filter = "grayscale(18%)";
              image.style.opacity = "0.88";
            }
            imageContainer.appendChild(
              image
            );
          } else {
            const noImage = document.createElement(
              "div"
            );
            noImage.textContent = "Sem imagem";
            noImage.style.cssText = `
            height:100%;

            display:flex;

            align-items:center;
            justify-content:center;

            color:#888;

            font-size:12px;
        `;
            imageContainer.appendChild(
              noImage
            );
          }
          if (isCurrentlySold && !isRemovedSold) {
            const soldBanner = document.createElement(
              "div"
            );
            soldBanner.textContent = "VENDIDO";
            soldBanner.style.cssText = `
        position:absolute;

        top:0;
        left:0;
        right:0;

        height:30px;

        display:flex;

        align-items:center;
        justify-content:center;

        background:#2f8f5b;

        color:white;

        font-size:11px;

        font-weight:800;

        letter-spacing:0.6px;

        text-transform:uppercase;

        box-shadow:
            0 2px 6px
            rgba(0,0,0,0.18);

        z-index:2;
    `;
            imageContainer.appendChild(
              soldBanner
            );
          }
          const typeBadge = document.createElement(
            "div"
          );
          typeBadge.textContent = theme.label;
          typeBadge.style.cssText = `
        position:absolute;

        top:
    ${isCurrentlySold ? "39px" : "9px"};
        right:9px;

        padding:5px 8px;

        border-radius:999px;

        font-size:10px;
        font-weight:bold;

        color:${theme.color};

        background:${theme.background};

        border:1px solid ${theme.border};

        box-shadow:
            0 1px 4px rgba(0,0,0,0.12);

        z-index:3;
    `;
          imageContainer.appendChild(
            typeBadge
          );
          if (record.isFavourite === true && record.removedAsSold !== true) {
            const folderButton = document.createElement(
              "button"
            );
            folderButton.type = "button";
            folderButton.style.cssText = `
        position:absolute;

        right:9px;
        bottom:9px;

        min-width:32px;
        height:30px;

        padding:
            0 8px;

        display:flex;

        align-items:center;
        justify-content:center;

        border:
            1px solid #b9dcdc;

        border-radius:999px;

        cursor:pointer;

        font-size:11px;

        font-weight:700;

        box-shadow:
            0 2px 6px
            rgba(0,0,0,0.14);

        z-index:3;

        transition:
            transform 0.12s ease,
            box-shadow 0.12s ease,
            background 0.12s ease;
    `;
            updateCardFolderButton(
              folderButton,
              record.id
            );
            folderButton.addEventListener(
              "mouseenter",
              function() {
                folderButton.style.transform = "translateY(-1px)";
                folderButton.style.boxShadow = "0 4px 9px rgba(0,0,0,0.18)";
              }
            );
            folderButton.addEventListener(
              "mouseleave",
              function() {
                folderButton.style.transform = "translateY(0)";
                folderButton.style.boxShadow = "0 2px 6px rgba(0,0,0,0.14)";
              }
            );
            folderButton.addEventListener(
              "click",
              function(event) {
                event.preventDefault();
                event.stopPropagation();
                openFolderMenu(
                  record,
                  folderButton
                );
              }
            );
            imageContainer.appendChild(
              folderButton
            );
          }
          if (isRemovedSold) {
            const soldBadge = document.createElement(
              "div"
            );
            soldBadge.textContent = "VENDIDO";
            soldBadge.style.cssText = `
        position:absolute;

        top:9px;
        left:9px;

        padding:5px 8px;

        border-radius:999px;

        font-size:10px;
        font-weight:800;

        color:#a12626;

        background:#fff0f0;

        border:1px solid #e6b4b4;

        box-shadow:
            0 1px 4px rgba(0,0,0,0.12);
    `;
            imageContainer.appendChild(
              soldBadge
            );
          }
          const content = document.createElement(
            "div"
          );
          content.style.cssText = `
        padding:11px 11px 12px 11px;
    `;
          const name = document.createElement(
            "div"
          );
          name.textContent = record.name || "Sem nome";
          name.title = record.name || "";
          name.style.cssText = `
        font-size:13px;

        font-weight:700;

        white-space:nowrap;

        overflow:hidden;

        text-overflow:ellipsis;

        margin-bottom:5px;

        color:#222;
    `;
          const information = document.createElement(
            "div"
          );
          information.textContent = record.brand || "";
          information.style.cssText = `
        font-size:11px;

        color:#777;

        white-space:nowrap;

        overflow:hidden;

        text-overflow:ellipsis;

        margin-bottom:
            ${record.status ? "6px" : "9px"};

        min-height:14px;
    `;
          let statusBadge = null;
          if (record.status) {
            statusBadge = document.createElement(
              "div"
            );
            statusBadge.textContent = record.status;
            statusBadge.style.cssText = `
            display:inline-block;

            padding:4px 8px;

            margin-bottom:9px;

            border-radius:999px;

            font-size:10px;

            font-weight:700;

            line-height:1.2;

            color:#006d75;

            background:#edf8f8;

            border:1px solid #b5dddd;
        `;
          }
          const bottom = document.createElement(
            "div"
          );
          bottom.style.cssText = `
        display:flex;

        align-items:center;

        justify-content:space-between;

        gap:8px;
    `;
          const price = document.createElement(
            "div"
          );
          price.textContent = Number.isFinite(
            record.price
          ) ? `${record.price.toFixed(2)} \u20AC` : "Pre\xE7o desconhecido";
          price.style.cssText = `
        font-size:16px;

        font-weight:750;

        color:#007782;
    `;
          const favouriteCount = document.createElement(
            "div"
          );
          favouriteCount.style.cssText = `
        display:flex;

        align-items:center;

        gap:4px;

        font-size:11px;

        font-weight:600;

        color:#666;
    `;
          if (Number.isFinite(
            record.favouriteCount
          )) {
            const heart = document.createElement(
              "button"
            );
            heart.type = "button";
            updateOrganizerHeart(
              heart,
              record
            );
            heart.title = "Remover dos favoritos";
            heart.style.cssText = `
    display:flex;

    align-items:center;
    justify-content:center;

    width:22px;
    height:22px;

    padding:0;

    border:none;

    border-radius:50%;

    background:transparent;

    color:#e5484d;

    font-size:16px;

    line-height:1;

    cursor:pointer;

    transition:
        transform 0.12s ease,
        background 0.12s ease,
        color 0.12s ease;
`;
            heart.addEventListener(
              "mouseenter",
              function() {
                if (heart.disabled) {
                  return;
                }
                heart.style.transform = "scale(1.16)";
                heart.style.background = "#fdecec";
              }
            );
            heart.addEventListener(
              "mouseleave",
              function() {
                heart.style.transform = "scale(1)";
                heart.style.background = "transparent";
              }
            );
            if (record.removedAsSold !== true) {
              heart.addEventListener(
                "click",
                async function(event) {
                  event.preventDefault();
                  event.stopPropagation();
                  await toggleFavouriteFromOrganizer(
                    record,
                    heart
                  );
                }
              );
            } else {
              heart.style.cursor = "default";
              heart.title = "";
            }
            const favouriteNumber = document.createElement(
              "span"
            );
            favouriteNumber.textContent = record.favouriteCount;
            favouriteCount.appendChild(
              heart
            );
            favouriteCount.appendChild(
              favouriteNumber
            );
          }
          bottom.appendChild(
            price
          );
          bottom.appendChild(
            favouriteCount
          );
          const change = getLastPriceChange(
            record
          );
          let changeElement = null;
          if (change) {
            const isDrop = change.difference < 0;
            changeElement = document.createElement(
              "div"
            );
            const arrow = isDrop ? "\u2193" : "\u2191";
            changeElement.textContent = `${arrow} ${Math.abs(
              change.difference
            ).toFixed(2)} \u20AC  (${Math.abs(
              change.percentage
            ).toFixed(1)}%)`;
            changeElement.style.cssText = `
            display:inline-block;

            margin-top:9px;

            padding:5px 8px;

            border-radius:999px;

            font-size:11px;

            font-weight:700;

            color:
                ${isDrop ? "#18794e" : "#c23636"};

            background:
                ${isDrop ? "#e9f7ef" : "#fdecec"};

            border:
                1px solid
                ${isDrop ? "#b7dfc8" : "#efb9b9"};
        `;
          }
          let removedDateElement = null;
          if (isRemovedSold && record.removedAsSoldAt) {
            const removedDate = new Date(
              record.removedAsSoldAt
            );
            if (!Number.isNaN(
              removedDate.getTime()
            )) {
              removedDateElement = document.createElement(
                "div"
              );
              removedDateElement.textContent = `Removido em ${removedDate.toLocaleDateString(
                "pt-PT"
              )}`;
              removedDateElement.style.cssText = `
            margin-top:9px;

            padding-top:8px;

            border-top:1px solid #e3e3e3;

            font-size:10px;

            color:#777;

            font-weight:600;
        `;
            }
          }
          content.appendChild(
            name
          );
          content.appendChild(
            information
          );
          if (statusBadge) {
            content.appendChild(
              statusBadge
            );
          }
          content.appendChild(
            bottom
          );
          if (changeElement) {
            content.appendChild(
              changeElement
            );
          }
          if (removedDateElement) {
            content.appendChild(
              removedDateElement
            );
          }
          card.appendChild(
            imageContainer
          );
          card.appendChild(
            content
          );
          return card;
        }
        function getTypeTheme(record) {
          const type = getRecordType(record);
          const themes = {
            GPU: {
              label: "GPU",
              color: "#007782",
              background: "#e6f5f6",
              border: "#9fd7db"
            },
            CPU: {
              label: "CPU",
              color: "#2457a6",
              background: "#eaf1fb",
              border: "#aec6ea"
            },
            Componente: {
              label: "Componente",
              color: "#7048a8",
              background: "#f1ebfa",
              border: "#cbb8e8"
            },
            Roupa: {
              label: "Roupa",
              color: "#b85f00",
              background: "#fff1df",
              border: "#f2c487"
            },
            Outro: {
              label: "Outro",
              color: "#666",
              background: "#f0f0f0",
              border: "#d4d4d4"
            }
          };
          return themes[type] || themes.Outro;
        }
        function renderOrganizerView() {
          closeActiveFolderMenu();
          const grid = document.getElementById(
            UI_IDS.organizerGrid
          );
          const count = document.getElementById(
            UI_IDS.organizerViewCount
          );
          if (!grid || !count) {
            return;
          }
          const allRecords = getFavouriteRecords();
          const filteredRecords = getFilteredOrganizerRecords();
          const records = sortOrganizerRecords(
            filteredRecords
          );
          grid.innerHTML = "";
          count.textContent = `${records.length} de ${allRecords.length} favoritos`;
          const counter = document.getElementById(
            UI_IDS.resultCount
          );
          if (counter) {
            counter.textContent = `${records.length} de ${allRecords.length} favoritos`;
          }
          if (allRecords.length === 0) {
            grid.innerHTML = `
            <div style="
                font-size:14px;
                color:#666;
            ">
                Ainda n\xE3o existem favoritos sincronizados.
                Usa "Sincronizar todos os favoritos".
            </div>
        `;
            return;
          }
          if (records.length === 0) {
            grid.innerHTML = `
            <div style="
                font-size:14px;
                color:#666;
            ">
                Nenhum favorito corresponde aos filtros.
            </div>
        `;
            return;
          }
          records.forEach(
            function(record) {
              grid.appendChild(
                createOrganizerCard(
                  record
                )
              );
            }
          );
        }
        function setCurrentView(view) {
          currentView = view;
          const organizerView = document.getElementById(
            UI_IDS.organizerView
          );
          const dashboardView = document.getElementById(
            UI_IDS.dashboardView
          );
          const soldHistoryView = document.getElementById(
            UI_IDS.soldHistoryView
          );
          const vintedButton = document.getElementById(
            UI_IDS.viewVinted
          );
          const organizerButton = document.getElementById(
            UI_IDS.viewOrganizer
          );
          const dashboardButton = document.getElementById(
            UI_IDS.viewDashboard
          );
          if (soldHistoryView) {
            soldHistoryView.style.display = "none";
          }
          if (organizerView) {
            organizerView.style.display = view === "organizer" ? "block" : "none";
          }
          if (dashboardView) {
            dashboardView.style.display = view === "dashboard" ? "block" : "none";
          }
          function updateViewButton(button, active) {
            if (!button) {
              return;
            }
            button.style.fontWeight = active ? "700" : "600";
            button.style.background = active ? "#007782" : "transparent";
            button.style.color = active ? "white" : "#526363";
            button.style.boxShadow = active ? "0 2px 6px rgba(0,119,130,0.22)" : "none";
          }
          updateViewButton(
            vintedButton,
            view === "vinted"
          );
          updateViewButton(
            organizerButton,
            view === "organizer"
          );
          updateViewButton(
            dashboardButton,
            view === "dashboard"
          );
          if (view === "organizer") {
            populateBrandFilterFromCache();
            renderOrganizerView();
            return;
          }
          if (view === "dashboard") {
            renderDashboard();
            return;
          }
          populateBrandFilter();
          applyFilters();
        }
        function getPanelSectionKey(section) {
          const title = section.querySelector(
            ".vfo-section-title"
          )?.textContent?.trim()?.toLowerCase() || "";
          if (title.includes(
            "atualiza\xE7\xE3o"
          )) {
            return "update";
          }
          if (title.includes(
            "organizar"
          )) {
            return "organize";
          }
          if (title.includes(
            "pastas"
          )) {
            return "folders";
          }
          if (title.includes(
            "filtros"
          )) {
            return "filters";
          }
          if (title.includes(
            "actividade"
          )) {
            return "activity";
          }
          return null;
        }
        function getSavedPanelSectionOrder() {
          try {
            const saved = JSON.parse(
              localStorage.getItem(
                PANEL_LAYOUT_STORAGE_KEY
              )
            );
            if (!Array.isArray(
              saved
            )) {
              return [
                ...DEFAULT_PANEL_SECTION_ORDER
              ];
            }
            const valid = saved.filter(
              function(key) {
                return DEFAULT_PANEL_SECTION_ORDER.includes(
                  key
                );
              }
            );
            DEFAULT_PANEL_SECTION_ORDER.forEach(
              function(key) {
                if (!valid.includes(
                  key
                )) {
                  valid.push(
                    key
                  );
                }
              }
            );
            return valid;
          } catch (error) {
            console.warn(
              "N\xE3o foi poss\xEDvel restaurar o layout do painel:",
              error
            );
            return [
              ...DEFAULT_PANEL_SECTION_ORDER
            ];
          }
        }
        function savePanelSectionOrder() {
          const container = document.getElementById(
            "vfo-panel-sections"
          );
          if (!container) {
            return;
          }
          const order = Array.from(
            container.children
          ).map(
            function(section) {
              return section.dataset.vfoSection;
            }
          ).filter(
            Boolean
          );
          localStorage.setItem(
            PANEL_LAYOUT_STORAGE_KEY,
            JSON.stringify(
              order
            )
          );
          updatePanelResetButton();
        }
        function getCurrentPanelSectionOrder() {
          const container = document.getElementById(
            "vfo-panel-sections"
          );
          if (!container) {
            return [];
          }
          return Array.from(
            container.children
          ).map(
            function(section) {
              return section.dataset.vfoSection;
            }
          ).filter(
            Boolean
          );
        }
        function isDefaultPanelSectionOrder() {
          const currentOrder = getCurrentPanelSectionOrder();
          if (currentOrder.length !== DEFAULT_PANEL_SECTION_ORDER.length) {
            return false;
          }
          return DEFAULT_PANEL_SECTION_ORDER.every(
            function(key, index) {
              return currentOrder[index] === key;
            }
          );
        }
        function updatePanelResetButton() {
          const button = document.getElementById(
            "vfo-reset-panel-layout"
          );
          if (!button) {
            return;
          }
          const isDefault = isDefaultPanelSectionOrder();
          button.disabled = isDefault;
          if (isDefault) {
            button.style.cursor = "default";
            button.style.opacity = "0.45";
            button.style.background = "transparent";
            button.style.color = "#7c8d8e";
          } else {
            button.style.cursor = "pointer";
            button.style.opacity = "1";
            button.style.background = "#ffffff";
            button.style.color = "#007782";
          }
        }
        function resetPanelSectionOrder() {
          const container = document.getElementById(
            "vfo-panel-sections"
          );
          if (!container) {
            return;
          }
          DEFAULT_PANEL_SECTION_ORDER.forEach(
            function(key) {
              const section = container.querySelector(
                `[data-vfo-section="${key}"]`
              );
              if (section) {
                container.appendChild(
                  section
                );
              }
            }
          );
          localStorage.removeItem(
            PANEL_LAYOUT_STORAGE_KEY
          );
          updatePanelResetButton();
        }
        function setupPanelLayoutControls(panel) {
          if (panel.querySelector(
            "#vfo-panel-layout-controls"
          )) {
            return;
          }
          const sectionsContainer = panel.querySelector(
            "#vfo-panel-sections"
          );
          if (!sectionsContainer) {
            return;
          }
          const controls = document.createElement(
            "div"
          );
          controls.id = "vfo-panel-layout-controls";
          controls.style.cssText = `
        display:flex;

        justify-content:flex-end;

        align-items:center;

        margin:
            -2px 2px 8px 2px;
    `;
          const resetButton = document.createElement(
            "button"
          );
          resetButton.id = "vfo-reset-panel-layout";
          resetButton.type = "button";
          resetButton.textContent = "\u21BA Repor layout";
          resetButton.title = "Repor ordem original dos m\xF3dulos";
          resetButton.style.cssText = `
        padding:
            5px 8px;

        border:
            1px solid #d3e3e3;

        border-radius:7px;

        background:
            transparent;

        color:
            #7c8d8e;

        font-size:10px;

        font-weight:650;

        cursor:
            default;

        opacity:
            0.45;

        transition:
            background 0.12s ease,
            color 0.12s ease,
            border-color 0.12s ease,
            opacity 0.12s ease,
            box-shadow 0.12s ease;
    `;
          resetButton.addEventListener(
            "mouseenter",
            function() {
              if (resetButton.disabled) {
                return;
              }
              resetButton.style.background = "#eaf5f5";
              resetButton.style.borderColor = "#b8dede";
            }
          );
          resetButton.addEventListener(
            "mouseleave",
            function() {
              if (resetButton.disabled) {
                return;
              }
              resetButton.style.background = "#ffffff";
              resetButton.style.borderColor = "#d3e3e3";
            }
          );
          resetButton.addEventListener(
            "click",
            function() {
              if (resetButton.disabled) {
                return;
              }
              resetPanelSectionOrder();
            }
          );
          controls.appendChild(
            resetButton
          );
          panel.insertBefore(
            controls,
            sectionsContainer
          );
        }
        function setupPanelSections(panel) {
          const sections = Array.from(
            panel.querySelectorAll(
              ":scope > .vfo-section"
            )
          );
          if (sections.length === 0) {
            return;
          }
          const container = document.createElement(
            "div"
          );
          container.id = "vfo-panel-sections";
          sections.forEach(
            function(section) {
              const key = getPanelSectionKey(
                section
              );
              if (!key) {
                return;
              }
              section.dataset.vfoSection = key;
            }
          );
          panel.appendChild(
            container
          );
          sections.forEach(
            function(section) {
              container.appendChild(
                section
              );
            }
          );
          const savedOrder = getSavedPanelSectionOrder();
          savedOrder.forEach(
            function(key) {
              const section = container.querySelector(
                `[data-vfo-section="${key}"]`
              );
              if (section) {
                container.appendChild(
                  section
                );
              }
            }
          );
        }
        function setupPanelSectionDragAndDrop(panel) {
          const container = document.getElementById(
            "vfo-panel-sections"
          ) || panel.querySelector(
            "#vfo-panel-sections"
          );
          if (!container) {
            console.warn(
              "Container das sec\xE7\xF5es do painel n\xE3o encontrado."
            );
            return;
          }
          let dragState = null;
          function getDraggableSections() {
            return Array.from(
              container.querySelectorAll(
                ":scope > [data-vfo-section]"
              )
            );
          }
          function getSectionAfterPointer(pointerY, draggedSection) {
            const candidates = getDraggableSections().filter(
              function(section) {
                return section !== draggedSection;
              }
            );
            for (const section of candidates) {
              const rect = section.getBoundingClientRect();
              const middle = rect.top + rect.height / 2;
              if (pointerY < middle) {
                return section;
              }
            }
            return null;
          }
          function captureSectionPositions() {
            const positions = /* @__PURE__ */ new Map();
            getDraggableSections().forEach(
              function(section) {
                if (dragState && section === dragState.section) {
                  return;
                }
                if (section.style.display === "none") {
                  return;
                }
                const rect = section.getBoundingClientRect();
                positions.set(
                  section,
                  {
                    top: rect.top,
                    left: rect.left
                  }
                );
              }
            );
            return positions;
          }
          function animateSectionReflow(previousPositions) {
            previousPositions.forEach(
              function(previous, section) {
                if (!section.isConnected) {
                  return;
                }
                const current = section.getBoundingClientRect();
                const deltaY = previous.top - current.top;
                const deltaX = previous.left - current.left;
                if (Math.abs(deltaY) < 1 && Math.abs(deltaX) < 1) {
                  return;
                }
                if (section.__vfoReflowAnimation) {
                  section.__vfoReflowAnimation.cancel();
                }
                section.__vfoReflowAnimation = section.animate(
                  [
                    {
                      transform: `translate(
                                    ${deltaX}px,
                                    ${deltaY}px
                                )`
                    },
                    {
                      transform: "translate(0, 0)"
                    }
                  ],
                  {
                    duration: 170,
                    easing: "cubic-bezier(0.22, 1, 0.36, 1)"
                  }
                );
                section.__vfoReflowAnimation.addEventListener(
                  "finish",
                  function() {
                    section.__vfoReflowAnimation = null;
                  },
                  {
                    once: true
                  }
                );
              }
            );
          }
          function animateDroppedSection(section) {
            if (!section || typeof section.animate !== "function") {
              return;
            }
            section.animate(
              [
                {
                  opacity: 0.78,
                  transform: "scale(0.985)"
                },
                {
                  opacity: 1,
                  transform: "scale(1)"
                }
              ],
              {
                duration: 180,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)"
              }
            );
          }
          function copyFormState(source, clone) {
            const sourceControls = source.querySelectorAll(
              "input, select, textarea"
            );
            const cloneControls = clone.querySelectorAll(
              "input, select, textarea"
            );
            sourceControls.forEach(
              function(sourceControl, index) {
                const cloneControl = cloneControls[index];
                if (!cloneControl) {
                  return;
                }
                if (sourceControl instanceof HTMLInputElement) {
                  cloneControl.value = sourceControl.value;
                  cloneControl.checked = sourceControl.checked;
                }
                if (sourceControl instanceof HTMLSelectElement) {
                  cloneControl.value = sourceControl.value;
                }
                if (sourceControl instanceof HTMLTextAreaElement) {
                  cloneControl.value = sourceControl.value;
                }
              }
            );
          }
          function removeIdsFromClone(root) {
            if (root.hasAttribute(
              "id"
            )) {
              root.removeAttribute(
                "id"
              );
            }
            root.querySelectorAll(
              "[id]"
            ).forEach(
              function(element) {
                element.removeAttribute(
                  "id"
                );
              }
            );
          }
          function createDragGhost(section, rect) {
            const ghost = section.cloneNode(
              true
            );
            copyFormState(
              section,
              ghost
            );
            removeIdsFromClone(
              ghost
            );
            ghost.classList.add(
              "vfo-drag-ghost"
            );
            ghost.setAttribute(
              "aria-hidden",
              "true"
            );
            const panelStyle = getComputedStyle(
              panel
            );
            ghost.style.position = "fixed";
            ghost.style.left = `${rect.left}px`;
            ghost.style.top = `${rect.top}px`;
            ghost.style.width = `${rect.width}px`;
            ghost.style.height = `${rect.height}px`;
            ghost.style.margin = "0";
            ghost.style.boxSizing = "border-box";
            ghost.style.zIndex = "2147483646";
            ghost.style.pointerEvents = "none";
            ghost.style.willChange = "top, left, transform";
            ghost.style.opacity = "0.98";
            ghost.style.background = "#ffffff";
            ghost.style.borderColor = "#69b6bb";
            ghost.style.transform = "translateX(-6px) scale(1.025)";
            ghost.style.transformOrigin = "center center";
            ghost.style.boxShadow = `
                0 22px 46px
                rgba(0,0,0,0.24),

                0 7px 18px
                rgba(0,119,130,0.16)
            `;
            ghost.style.overflow = "hidden";
            ghost.style.fontFamily = panelStyle.fontFamily;
            ghost.style.color = panelStyle.color;
            ghost.style.transition = `
                box-shadow 0.12s ease,
                transform 0.12s ease
            `;
            document.body.appendChild(
              ghost
            );
            return ghost;
          }
          function createDragPlaceholder(section, rect) {
            const placeholder = document.createElement(
              "div"
            );
            const sectionStyle = getComputedStyle(
              section
            );
            placeholder.className = "vfo-drag-placeholder";
            placeholder.setAttribute(
              "aria-hidden",
              "true"
            );
            placeholder.style.height = `${rect.height}px`;
            placeholder.style.width = "100%";
            placeholder.style.boxSizing = "border-box";
            placeholder.style.marginBottom = sectionStyle.marginBottom;
            placeholder.style.borderRadius = sectionStyle.borderRadius || "11px";
            placeholder.style.background = "rgba(0,119,130,0.075)";
            placeholder.style.border = `
                2px dashed
                rgba(0,119,130,0.38)
            `;
            placeholder.style.boxShadow = `
                inset 0 0 0 1px
                rgba(0,119,130,0.03)
            `;
            placeholder.style.transition = `
                background 0.12s ease,
                border-color 0.12s ease
            `;
            return placeholder;
          }
          function beginActualDrag(event) {
            if (!dragState || dragState.dragging) {
              return;
            }
            const section = dragState.section;
            const rect = section.getBoundingClientRect();
            const placeholder = createDragPlaceholder(
              section,
              rect
            );
            container.insertBefore(
              placeholder,
              section
            );
            const ghost = createDragGhost(
              section,
              rect
            );
            dragState.dragging = true;
            dragState.placeholder = placeholder;
            dragState.ghost = ghost;
            dragState.rect = rect;
            dragState.offsetY = event.clientY - rect.top;
            dragState.offsetX = event.clientX - rect.left;
            section.style.display = "none";
            dragState.handle.style.cursor = "grabbing";
            dragState.handle.style.color = "#007782";
            dragState.handle.style.background = "#eaf5f5";
            document.body.style.cursor = "grabbing";
            document.body.style.userSelect = "none";
          }
          function startDrag(event, section, handle) {
            if (event.pointerType === "mouse" && event.button !== 0) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            dragState = {
              section,
              handle,
              startX: event.clientX,
              startY: event.clientY,
              originalDisplay: section.style.display,
              dragging: false,
              placeholder: null,
              ghost: null,
              rect: null,
              offsetX: 0,
              offsetY: 0
            };
            handle.style.cursor = "grabbing";
            document.body.style.userSelect = "none";
          }
          function moveDrag(event) {
            if (!dragState) {
              return;
            }
            const distanceX = event.clientX - dragState.startX;
            const distanceY = event.clientY - dragState.startY;
            const distance = Math.hypot(
              distanceX,
              distanceY
            );
            if (!dragState.dragging && distance < 5) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (!dragState.dragging) {
              beginActualDrag(
                event
              );
            }
            if (!dragState || !dragState.dragging) {
              return;
            }
            const {
              section,
              ghost,
              placeholder,
              rect
            } = dragState;
            const newTop = event.clientY - dragState.offsetY;
            const horizontalMovement = Math.max(
              -26,
              Math.min(
                26,
                event.clientX - dragState.startX
              )
            );
            ghost.style.top = `${newTop}px`;
            ghost.style.left = `${rect.left + horizontalMovement}px`;
            const panelRect = panel.getBoundingClientRect();
            const scrollEdge = 42;
            if (event.clientY < panelRect.top + scrollEdge) {
              panel.scrollTop -= 10;
            } else if (event.clientY > panelRect.bottom - scrollEdge) {
              panel.scrollTop += 10;
            }
            const nextSection = getSectionAfterPointer(
              event.clientY,
              section
            );
            const currentNext = placeholder.nextElementSibling;
            const targetChanged = nextSection ? currentNext !== nextSection : placeholder !== container.lastElementChild;
            if (targetChanged) {
              const previousPositions = captureSectionPositions();
              if (nextSection) {
                container.insertBefore(
                  placeholder,
                  nextSection
                );
              } else {
                container.appendChild(
                  placeholder
                );
              }
              animateSectionReflow(
                previousPositions
              );
            }
          }
          function resetDragVisualState(handle) {
            if (handle) {
              handle.style.cursor = "grab";
              handle.style.color = "#8aa2a4";
              handle.style.background = "transparent";
            }
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
          }
          function completeDrag(commit) {
            if (!dragState) {
              return;
            }
            const {
              section,
              handle,
              dragging,
              placeholder,
              ghost,
              originalDisplay
            } = dragState;
            if (dragging) {
              if (commit && placeholder && placeholder.parentNode) {
                placeholder.parentNode.insertBefore(
                  section,
                  placeholder
                );
              }
              section.style.display = originalDisplay;
              if (ghost) {
                ghost.remove();
              }
              if (placeholder) {
                placeholder.remove();
              }
              if (commit) {
                animateDroppedSection(
                  section
                );
                savePanelSectionOrder();
              }
            }
            resetDragVisualState(
              handle
            );
            dragState = null;
          }
          function finishDrag(event) {
            if (!dragState) {
              return;
            }
            if (event) {
              event.preventDefault();
              event.stopPropagation();
            }
            const cancelled = event && event.type === "pointercancel";
            completeDrag(
              !cancelled
            );
          }
          function handleDragKeydown(event) {
            if (!dragState || event.key !== "Escape") {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            completeDrag(
              false
            );
          }
          window.addEventListener(
            "pointermove",
            moveDrag,
            {
              capture: true,
              passive: false
            }
          );
          window.addEventListener(
            "pointerup",
            finishDrag,
            {
              capture: true
            }
          );
          window.addEventListener(
            "pointercancel",
            finishDrag,
            {
              capture: true
            }
          );
          window.addEventListener(
            "keydown",
            handleDragKeydown,
            {
              capture: true
            }
          );
          const sections = getDraggableSections();
          sections.forEach(
            function(section) {
              const title = section.querySelector(
                ".vfo-section-title"
              );
              if (!title) {
                return;
              }
              if (title.querySelector(
                ".vfo-drag-handle"
              )) {
                return;
              }
              const handle = document.createElement(
                "span"
              );
              handle.className = "vfo-drag-handle";
              handle.textContent = "\u283F";
              handle.title = "Arrastar sec\xE7\xE3o";
              handle.setAttribute(
                "aria-label",
                "Arrastar sec\xE7\xE3o"
              );
              handle.style.cssText = `
                margin-left:auto;

                padding:
                    1px 4px;

                border-radius:5px;

                color:#8aa2a4;

                font-size:15px;

                line-height:1;

                cursor:grab;

                user-select:none;

                touch-action:none;

                transition:
                    color 0.12s ease,
                    background 0.12s ease;
            `;
              handle.addEventListener(
                "mouseenter",
                function() {
                  if (!dragState) {
                    handle.style.color = "#007782";
                    handle.style.background = "#eaf5f5";
                  }
                }
              );
              handle.addEventListener(
                "mouseleave",
                function() {
                  if (!dragState || dragState.handle !== handle) {
                    handle.style.color = "#8aa2a4";
                    handle.style.background = "transparent";
                  }
                }
              );
              handle.addEventListener(
                "pointerdown",
                function(event) {
                  startDrag(
                    event,
                    section,
                    handle
                  );
                }
              );
              title.appendChild(
                handle
              );
            }
          );
        }
        function createOrganizer() {
          if (document.getElementById(
            UI_IDS.panel
          )) {
            return;
          }
          const panel = document.createElement("div");
          panel.id = UI_IDS.panel;
          panel.style.cssText = `
    position:fixed;

    top:90px;
    right:16px;

    width:310px;

    max-height:
        calc(100vh - 106px);

    overflow-y:auto;

    background:#eef7f7;

    padding:12px;

    border:
        1px solid #cfe2e2;

    border-radius:16px;

    box-shadow:
        0 10px 32px
        rgba(0,0,0,0.14);

    z-index:99999;

    box-sizing:border-box;

    font-family:
        Arial,
        sans-serif;

    color:#253333;
`;
          panel.innerHTML = `

<style>

    .vfo-section {
    background:#ffffff;

    border:
        1px solid #d8e7e7;

    border-radius:11px;

    padding:13px;

    margin-bottom:12px;

    box-shadow:
        0 2px 6px
        rgba(0,0,0,0.045);
    }


    .vfo-section-title {
    display:flex;

    align-items:center;

    gap:6px;

    margin-bottom:12px;

    padding-bottom:7px;

    border-bottom:
        1px solid #edf2f2;

    font-size:12px;

    font-weight:750;

    color:#007782;

    letter-spacing:0.15px;
    }


    .vfo-label {
        display:block;

        margin-bottom:6px;

        font-size:12px;

        font-weight:600;

        color:#526363;
    }


    .vfo-input,
.vfo-select {
    width:100%;

    padding:9px 10px;

    border:
        1px solid #ccdada;

    border-radius:8px;

    box-sizing:border-box;

    background:#ffffff;

    color:#253333;

    font-size:13px;

    outline:none;

    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        background 0.15s ease;
}


.vfo-input:hover,
.vfo-select:hover {
    border-color:#aacaca;
}


.vfo-input:focus,
.vfo-select:focus {
    border-color:#007782;

    background:#fcffff;

    box-shadow:
        0 0 0 3px
        rgba(0,119,130,0.10);
    }


    .vfo-input:focus,
    .vfo-select:focus {
        border-color:#007782;

        box-shadow:
            0 0 0 2px
            rgba(0,119,130,0.12);
    }


    .vfo-button {
    border:none;

    border-radius:8px;

    padding:9px 10px;

    font-size:12px;

    font-weight:650;

    cursor:pointer;

    transition:
        background 0.15s ease,
        transform 0.1s ease,
        box-shadow 0.15s ease;
}


.vfo-button:hover {
    box-shadow:
        0 3px 8px
        rgba(0,0,0,0.08);
}


.vfo-button:active {
    transform:
        translateY(1px);

    box-shadow:none;
    }


    .vfo-button:active {
        transform:
            translateY(1px);
    }


    .vfo-button-primary {
        background:#007782;

        color:white;
    }


    .vfo-button-primary:hover {
        background:#00636d;
    }


    .vfo-button-secondary {
        background:#edf7f7;

        color:#006d75;

        border:
            1px solid #bddddd;
    }


    .vfo-button-secondary:hover {
        background:#e2f2f2;
    }


    .vfo-button-neutral {
        background:#f4f5f5;

        color:#4f5f5f;

        border:
            1px solid #dedede;
    }


    .vfo-helper {
        font-size:10px;

        color:#7a8989;

        margin-top:4px;
    }

</style>


<!-- ================================================== -->
<!-- CABE\xC7ALHO -->
<!-- ================================================== -->

<div style="
    background:#f4fbfb;
    color:#0b5560;
    border:1px solid #cfe6e8;
    border-radius:12px;
    padding:12px 14px;
    margin-bottom:12px;
">
    <div style="
        font-size:15px;
        font-weight:700;
        line-height:1.2;
        margin-bottom:2px;
    ">
        Vinted Organizer
    </div>

    <div style="
        font-size:11px;
        color:#5f7b80;
        line-height:1.3;
    ">
        Organiza e acompanha os teus favoritos
    </div>

</div>


<!-- ================================================== -->
<!-- VISTAS                                            -->
<!-- ================================================== -->

<div style="
    display:flex;

    padding:4px;

    margin-bottom:12px;

    border-radius:10px;

    background:#dfecec;

    border:
        1px solid #d2e4e4;
">

    <button
        id="${UI_IDS.viewVinted}"
        style="
            flex:1;

            padding:8px 3px;

            border:none;

            border-radius:8px;

            cursor:pointer;

            background:#007782;

            color:white;

            font-size:11px;

            font-weight:700;

            transition:
                background 0.15s ease,
                color 0.15s ease;
        "
    >
        Vinted
    </button>


    <button
        id="${UI_IDS.viewOrganizer}"
        style="
            flex:1;

            padding:8px 3px;

            border:none;

            border-radius:8px;

            cursor:pointer;

            background:transparent;

            color:#526363;

            font-size:11px;

            font-weight:600;

            transition:
                background 0.15s ease,
                color 0.15s ease;
        "
    >
        Organizer
    </button>

    <button
    id="${UI_IDS.viewDashboard}"

    style="
        flex:1;

        padding:8px 3px;

        border:none;

        border-radius:8px;

        cursor:pointer;

        background:transparent;

        color:#526363;

        font-size:11px;

        font-weight:600;

        transition:
            background 0.15s ease,
            color 0.15s ease,
            box-shadow 0.15s ease;
    "
>
    Dashboard
</button>

</div>


<!-- ================================================== -->
<!-- ACTUALIZA\xC7\xC3O                                      -->
<!-- ================================================== -->

<div class="vfo-section">

    <div class="vfo-section-title">
        \u21BB Atualiza\xE7\xE3o
    </div>


    <button
        id="${UI_IDS.loadAll}"

        class="
            vfo-button
            vfo-button-primary
        "

        style="
            width:100%;
            margin-bottom:7px;
        "
    >
        \u21BB Atualizar favoritos
    </button>


    <div
        id="${UI_IDS.loadStatus}"

        style="
            min-height:15px;

            margin-bottom:10px;

            text-align:center;

            font-size:11px;

            color:#607272;
        "
    >
    </div>


    <div style="
        height:1px;

        margin:
            2px 0 10px 0;

        background:#edf1f1;
    ">
    </div>


    <button
        id="${UI_IDS.removeSold}"

        style="
            width:100%;

            padding:8px;

            margin-bottom:7px;

            border:
                1px solid #edcaca;

            border-radius:7px;

            cursor:pointer;

            background:#fff3f3;

            color:#b23a3a;

            font-size:12px;

            font-weight:650;
        "
    >
        \u{1F9F9} Remover vendidos
    </button>


    <div
        id="${UI_IDS.removeSoldStatus}"

        style="
            min-height:13px;

            margin-bottom:7px;

            text-align:center;

            font-size:10px;

            color:#677777;
        "
    >
    </div>


    <button
        id="${UI_IDS.soldHistoryButton}"

        class="
            vfo-button
            vfo-button-secondary
        "

        style="
            width:100%;
        "
    >
        \u{1F558} Vendidos removidos (0)
    </button>

</div>


<!-- ================================================== -->
<!-- ORGANIZA\xC7\xC3O                                       -->
<!-- ================================================== -->

<div class="vfo-section">

    <div class="vfo-section-title">
        \u21C5 Organizar
    </div>


    <label
        class="vfo-label"
        for="${UI_IDS.sort}"
    >
        Ordenar favoritos
    </label>


    <select
        id="${UI_IDS.sort}"
        class="vfo-select"
    >

        <option value="">
            Sem ordena\xE7\xE3o
        </option>


        <option value="price-asc">
            Pre\xE7o: menor \u2192 maior
        </option>


        <option value="price-desc">
            Pre\xE7o: maior \u2192 menor
        </option>


        <option value="name-asc">
            Nome: A \u2192 Z
        </option>


        <option value="name-desc">
            Nome: Z \u2192 A
        </option>

    </select>

</div>

<!-- ================================================== -->
<!-- PASTAS                                             -->
<!-- ================================================== -->

<div class="vfo-section">

    <div class="vfo-section-title">
        \u{1F4C1} Pastas
    </div>


    <div
        id="${UI_IDS.folderList}"
        style="
            display:flex;
            flex-direction:column;
            gap:4px;
            margin-bottom:10px;
        "
    >
    </div>


    <div style="
        display:flex;
        gap:5px;
    ">

        <input
            id="${UI_IDS.folderNameInput}"

            class="vfo-input"

            type="text"

            maxlength="40"

            placeholder="Nova pasta..."

            style="
                flex:1;
                min-width:0;
            "
        >


        <button
            id="${UI_IDS.folderCreateButton}"

            class="
                vfo-button
                vfo-button-primary
            "

            title="Criar pasta"

            style="
                width:38px;
                flex:none;
                font-size:17px;
                padding:0;
            "
        >
            +
        </button>

    </div>


    <div class="vfo-helper">
        Um favorito pode pertencer a v\xE1rias pastas
    </div>

</div>


<!-- ================================================== -->
<!-- FILTROS                                           -->
<!-- ================================================== -->

<div class="vfo-section">

    <div class="vfo-section-title">
        \u25C9 Filtros
    </div>


    <!-- NOME -->

    <label
        class="vfo-label"
        for="${UI_IDS.nameFilter}"
    >
        Pesquisar
    </label>


    <input
        id="${UI_IDS.nameFilter}"

        class="vfo-input"

        type="text"

        placeholder=
            "RTX 5700, Nike, casaco..."

        style="
            margin-bottom:11px;
        "
    >


    <!-- PRE\xC7O -->

    <div class="vfo-label">
        Intervalo de pre\xE7o
    </div>


    <div style="
        display:flex;
        gap:6px;
        margin-bottom:11px;
    ">

        <input
            id="${UI_IDS.priceMin}"

            class="vfo-input"

            type="number"

            placeholder="M\xEDn. \u20AC"
        >


        <input
            id="${UI_IDS.priceMax}"

            class="vfo-input"

            type="number"

            placeholder="M\xE1x. \u20AC"
        >

    </div>


    <!-- MARCAS -->

    <div class="vfo-label">
        Marcas
    </div>


    <div
        id="${UI_IDS.brandFilter}"

        style="
            width:100%;

            max-height:115px;

            overflow-y:auto;

            padding:6px 8px;

            margin-bottom:3px;

            border:
                1px solid #cfdcdc;

            border-radius:7px;

            box-sizing:border-box;

            background:#fbfdfd;
        "
    >

        <div style="
            font-size:11px;
            color:#7a8989;
        ">
            A carregar marcas...
        </div>

    </div>


    <div
        class="vfo-helper"

        style="
            margin-bottom:11px;
        "
    >
        Nenhuma seleccionada = todas
    </div>


    <!-- TIPO -->

    <label
        class="vfo-label"
        for="${UI_IDS.typeFilter}"
    >
        Tipo
    </label>


    <select
        id="${UI_IDS.typeFilter}"

        class="vfo-select"

        style="
            margin-bottom:11px;
        "
    >

        <option value="">
            Todos os tipos
        </option>

        <option value="GPU">
            GPU
        </option>

        <option value="CPU">
            CPU
        </option>

        <option value="Componente">
            Componente
        </option>

        <option value="Roupa">
            Roupa
        </option>

        <option value="Outro">
            Outro
        </option>

    </select>


    <!-- ESTADO -->

    <label
        class="vfo-label"
        for="${UI_IDS.statusFilter}"
    >
        Estado do artigo
    </label>


    <select
        id="${UI_IDS.statusFilter}"

        class="vfo-select"

        style="
            margin-bottom:13px;
        "
    >

        <option value="">
            Todos os estados
        </option>

    </select>


    <!-- BOT\xD5ES -->

    <div style="
        display:flex;

        gap:6px;

        margin-bottom:9px;
    ">

        <button
            id="${UI_IDS.applyFilters}"

            class="
                vfo-button
                vfo-button-primary
            "

            style="
                flex:1;
            "
        >
            Aplicar
        </button>


        <button
            id="${UI_IDS.clearFilters}"

            class="
                vfo-button
                vfo-button-neutral
            "

            style="
                flex:1;
            "
        >
            Limpar
        </button>

    </div>


    <!-- CONTADOR -->

    <div
        id="${UI_IDS.resultCount}"

        style="
            padding:7px;

            border-radius:6px;

            text-align:center;

            background:#eaf6f6;

color:#007782;

border:
    1px solid #d3eaea;

            font-size:11px;

            font-weight:650;
        "
    >
        0 de 0 favoritos
    </div>

</div>


<!-- ================================================== -->
<!-- ACTIVIDADE                                        -->
<!-- ================================================== -->

<div class="vfo-section">

    <div class="vfo-section-title">
        \u2195 Actividade
    </div>


    <div style="
        display:flex;

        justify-content:
            space-between;

        align-items:center;

        margin-bottom:7px;
    ">

        <div style="
            font-size:12px;

            font-weight:650;

            color:#526363;
        ">
            Altera\xE7\xF5es de pre\xE7o
        </div>


        <div
            id="${UI_IDS.priceHistorySummary}"

            style="
                font-size:10px;
                color:#718181;
            "
        >
            0 altera\xE7\xF5es
        </div>

    </div>


    <div
        id="${UI_IDS.priceHistory}"

        style="
            max-height:200px;

            overflow-y:auto;

            border-top:
                1px solid #edf1f1;
        "
    >
    </div>

</div>

`;
          setupPanelSections(
            panel
          );
          setupPanelLayoutControls(
            panel
          );
          document.body.appendChild(
            panel
          );
          setupPanelSectionDragAndDrop(
            panel
          );
          updatePanelResetButton();
          createOrganizerView();
          createDashboardView();
          createSoldHistoryView();
          document.getElementById(UI_IDS.loadAll).addEventListener(
            "click",
            loadAllListings
          );
          document.getElementById(
            UI_IDS.folderCreateButton
          ).addEventListener(
            "click",
            createFolderFromInterface
          );
          document.getElementById(
            UI_IDS.folderNameInput
          ).addEventListener(
            "keydown",
            function(event) {
              if (event.key === "Enter") {
                event.preventDefault();
                createFolderFromInterface();
              }
            }
          );
          document.getElementById(
            UI_IDS.sort
          ).addEventListener(
            "change",
            function() {
              if (currentView === "organizer") {
                renderOrganizerView();
                return;
              }
              switch (this.value) {
                case "price-asc":
                  sortByPrice(
                    "asc"
                  );
                  break;
                case "price-desc":
                  sortByPrice(
                    "desc"
                  );
                  break;
                case "name-asc":
                  sortByName(
                    "asc"
                  );
                  break;
                case "name-desc":
                  sortByName(
                    "desc"
                  );
                  break;
              }
            }
          );
          document.getElementById(
            UI_IDS.applyFilters
          ).addEventListener(
            "click",
            function() {
              if (currentView === "organizer") {
                populateBrandFilterFromCache();
                renderOrganizerView();
              } else {
                applyFilters();
              }
            }
          );
          document.getElementById(
            UI_IDS.removeSold
          ).addEventListener(
            "click",
            removeSoldListings
          );
          document.getElementById(
            UI_IDS.soldHistoryButton
          ).addEventListener(
            "click",
            openSoldHistoryView
          );
          document.getElementById(
            UI_IDS.soldHistoryClose
          ).addEventListener(
            "click",
            closeSoldHistoryView
          );
          document.getElementById(
            UI_IDS.clearFilters
          ).addEventListener(
            "click",
            function() {
              clearFilters();
              if (currentView === "organizer") {
                populateBrandFilterFromCache();
                renderOrganizerView();
              }
            }
          );
          document.getElementById(
            UI_IDS.viewVinted
          ).addEventListener(
            "click",
            function() {
              setCurrentView(
                "vinted"
              );
            }
          );
          document.getElementById(
            UI_IDS.viewOrganizer
          ).addEventListener(
            "click",
            function() {
              setCurrentView(
                "organizer"
              );
            }
          );
          document.getElementById(
            UI_IDS.viewDashboard
          ).addEventListener(
            "click",
            function() {
              setCurrentView(
                "dashboard"
              );
            }
          );
          waitForListings();
          populateStatusFilterFromCache();
          updateRemoveSoldButton();
          updateSoldHistoryButton();
          renderFolderList();
          console.log(
            "Vinted Organizer criado."
          );
        }
        function init() {
          restoreListingCacheFromStorage();
          restoreOrganizerFoldersFromStorage();
          createOrganizer();
        }
        if (document.readyState === "loading") {
          document.addEventListener(
            "DOMContentLoaded",
            init
          );
        } else {
          init();
        }
      })();
    }
  });
  require_main();
})();
