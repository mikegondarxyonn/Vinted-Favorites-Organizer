export const SELECTORS = {
    listing: '[data-testid="grid-item"]',
    itemLink: 'a[href*="/items/"]',
    price: '[data-testid$="--price-text"]',
    brand: '[data-testid$="--description-title"]'
};


export const UI_IDS = {
    viewVinted: 'vinted-view-vinted',
    viewOrganizer: 'vinted-view-organizer',
    viewDashboard: 'vinted-view-dashboard',
    dashboardView: 'vinted-dashboard-view',
    organizerView: 'vinted-organizer-view',
    organizerGrid: 'vinted-organizer-grid',
    organizerViewCount: 'vinted-organizer-view-count',
    panel: 'vinted-organizer',
    sort: 'vinted-sort',
    loadAll: 'vinted-load-all',
    loadStatus: 'vinted-load-status',
    nameFilter: 'vinted-name-filter',
    priceMin: 'vinted-price-min',
    priceMax: 'vinted-price-max',
    brandFilter: 'vinted-brand-filter',
    typeFilter: 'vinted-type-filter',
    statusFilter: 'vinted-status-filter',
    resultCount: 'vinted-result-count',
    applyFilters: 'vinted-apply-filters',
    clearFilters: 'vinted-clear-filters',
    priceHistory: 'vinted-price-history',
    priceHistorySummary: 'vinted-price-history-summary',
    removeSold: 'vinted-remove-sold',
    removeSoldStatus: 'vinted-remove-sold-status',
    soldHistoryButton: 'vinted-sold-history-button',
    soldHistoryView: 'vinted-sold-history-view',
    soldHistoryGrid: 'vinted-sold-history-grid',
    soldHistoryCount: 'vinted-sold-history-count',
    soldHistoryClose: 'vinted-sold-history-close',
    folderList: 'vinted-folder-list',
    folderNameInput: 'vinted-folder-name-input',
    folderCreateButton: 'vinted-folder-create-button',
};


export const FOLDER_FILTER_ALL =
    'all';


export const FOLDER_FILTER_UNFILED =
    'unfiled';


export const STORAGE_KEY =
    'vintedFavoritesOrganizer_listingCache_v1';


export const PANEL_LAYOUT_STORAGE_KEY =
    'vintedFavoritesOrganizer_panelLayout_v1';


export const DEFAULT_PANEL_SECTION_ORDER = [
    'update',
    'organize',
    'folders',
    'filters',
    'activity'
];


export const FOLDERS_STORAGE_KEY =
    'vintedFavoritesOrganizer_folders_v1';