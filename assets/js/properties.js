'use strict';



class PropertiesManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.properties = [];
        this.filteredProperties = [];
        this.currentPage = 1;
        this.propertiesPerPage = 10;
        this.currentView = 'grid';
        this.currentFilters = {};
        this.isLoading = false;
        
        this.#init();
    }

    async #init() {
        console.log('PropertiesManager #init started');
        try {

            await this.supabaseClient.waitForInit();
            console.log('Supabase initialized');

            console.log('1. Setting up location autocomplete...');
            this.#setupLocationAutocomplete();
            console.log('2. Setting up date pickers...');
            this.#setupDatePickers();
            console.log('3. Setting up guests dropdown...');
            this.#setupGuestsDropdown();
            console.log('4. Setting up event listeners...');
            this.#setupEventListeners();
            console.log('5. Setting up advanced filters...');
            this.#setupAdvancedFilters();
            console.log('6. Setting up view controls...');
            this.#setupViewControls();
            console.log('7. Setting up category tabs...');
            this.#setupCategoryTabs();
            console.log('8. Setting up compact nav search...');
            this.#setupCompactNavSearch();
            console.log('9. Setting up pagination...');
            this.#setupPagination();
            console.log('10. Handling URL parameters...');
            this.#handleUrlParameters();
            console.log('11. Loading properties...');
            this.#loadProperties();
            console.log('12. Updating auth UI...');
            this.#updateAuthUI();
            console.log('Initialization complete!');
        } catch (error) {
            
            this.#showError('Failed to initialize properties page. Please refresh.');
        }
    }

    #setupLocationAutocomplete() {
        const mainInput = document.getElementById('location');
        const mainDropdown = document.getElementById('locationAutocomplete');
        const navInput = document.getElementById('navLocation');
        const navDropdown = document.getElementById('navLocationAutocomplete');

        this.popularDestinations = [
            { name: 'New York', region: 'New York, United States', full: 'New York, New York, United States' },
            { name: 'Paris', region: 'France', full: 'Paris, France' },
            { name: 'London', region: 'United Kingdom', full: 'London, United Kingdom' },
            { name: 'Tokyo', region: 'Japan', full: 'Tokyo, Japan' },
            { name: 'Dubai', region: 'United Arab Emirates', full: 'Dubai, United Arab Emirates' },
            { name: 'Los Angeles', region: 'California, United States', full: 'Los Angeles, California, United States' },
            { name: 'Barcelona', region: 'Spain', full: 'Barcelona, Spain' },
            { name: 'Rome', region: 'Italy', full: 'Rome, Italy' }
        ];

        if (mainInput && mainDropdown) {
            this.#initAutocomplete(mainInput, mainDropdown, navInput);
        }

        if (navInput && navDropdown) {
            this.#initAutocomplete(navInput, navDropdown, mainInput);
        }
    }

    #initAutocomplete(input, dropdown, syncInput) {
        let debounceTimer;
        let selectedIndex = -1;

        const clearBtn = input.parentElement.querySelector('.clear-location-btn');
        
        const updateClearButton = () => {
            if (clearBtn) {
                clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
            }
        };
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                if (syncInput) syncInput.value = '';
                updateClearButton();
                hideDropdown();
                input.focus();
            });
        }

        const hideDropdown = () => {
            dropdown.classList.remove('active');
            selectedIndex = -1;
        };

        const showDropdown = () => {
            if (dropdown.children.length > 0) {
                dropdown.classList.add('active');
            }
        };

        const selectItem = (item) => {
            input.value = item.place_name || item.full_name;
            if (syncInput) syncInput.value = input.value;
            updateClearButton();
            hideDropdown();
        };

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            updateClearButton();

            clearTimeout(debounceTimer);

            if (query.length < 2) {
                hideDropdown();
                return;
            }

            dropdown.innerHTML = '<div class="autocomplete-loading">Searching...</div>';
            showDropdown();

            debounceTimer = setTimeout(async () => {
                try {
                    const results = await this.#searchLocations(query);
                    this.#renderAutocompleteResults(dropdown, results, selectItem);
                    showDropdown();
                } catch (error) {
                    
                    dropdown.innerHTML = '<div class="autocomplete-no-results">Error loading results</div>';
                }
            }, 300);
        });

        input.addEventListener('keydown', (e) => {
            const items = dropdown.querySelectorAll('.autocomplete-item');

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                this.#updateSelectedItem(items, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                this.#updateSelectedItem(items, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex]?.click();
            } else if (e.key === 'Escape') {
                hideDropdown();
            }
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                hideDropdown();
            }
        });

        input.addEventListener('focus', () => {
            const value = input.value.trim();
            if (value.length === 0) {
                this.#showPopularDestinations(dropdown, selectItem);
                showDropdown();
            } else if (dropdown.children.length > 0 && value.length >= 2) {
                showDropdown();
            }
        });
    }

    async #searchLocations(query) {

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=15&addressdetails=1&featuretype=city`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'RentThatView/1.0'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch locations');
        }

        const data = await response.json();

        const transformed = data.map(item => {
            const address = item.address || {};
            return {
                place_name: this.#formatPlaceName(item),
                full_name: this.#formatPlaceName(item),
                name: this.#getLocationName(item),
                region: this.#getRegion(item),
                type: item.type,
                class: item.class,
                importance: item.importance || 0,
                lat: item.lat,
                lon: item.lon,
                raw: item
            };
        });

        return this.#filterAndDeduplicateResults(transformed);
    }

    #getLocationName(item) {
        const address = item.address || {};

        if (address.city) return address.city;
        if (address.town) return address.town;
        if (address.village) return address.village;
        if (address.state) return address.state;
        if (address.country) return address.country;

        return item.name || item.display_name.split(',')[0].trim();
    }

    #formatPlaceName(item) {
        const address = item.address || {};
        const parts = [];

        const mainName = this.#getLocationName(item);
        parts.push(mainName);

        if (address.state && address.state !== mainName) {
            parts.push(address.state);
        }

        if (address.country) {
            parts.push(address.country);
        }
        
        return parts.join(', ');
    }

    #getRegion(item) {
        const address = item.address || {};
        const parts = [];

        const mainName = this.#getLocationName(item);
        
        if (address.state && address.state !== mainName) {
            parts.push(address.state);
        }
        if (address.country) {
            parts.push(address.country);
        }
        
        return parts.join(', ') || 'Location';
    }

    #filterAndDeduplicateResults(results) {

        const priorityTypes = ['city', 'town', 'village'];
        const avoidTypes = ['suburb', 'quarter', 'neighbourhood', 'administrative'];

        let filtered = results.filter(item => {

            if (item.importance < 0.3) return false;

            if (item.class === 'building' || item.class === 'amenity') return false;

            if (item.type === 'administrative' && item.name.toLowerCase().includes('governorate')) return false;
            if (item.name.toLowerCase().includes('governorate')) return false;
            if (item.name.toLowerCase().includes('district')) return false;
            if (item.name.toLowerCase().includes('province')) return false;
            
            return true;
        });

        filtered.sort((a, b) => {

            const aIsPriority = priorityTypes.includes(a.type);
            const bIsPriority = priorityTypes.includes(b.type);
            const aIsAvoid = avoidTypes.includes(a.type);
            const bIsAvoid = avoidTypes.includes(b.type);
            
            if (aIsPriority && !bIsPriority) return -1;
            if (!aIsPriority && bIsPriority) return 1;
            if (aIsAvoid && !bIsAvoid) return 1;
            if (!aIsAvoid && bIsAvoid) return -1;

            return b.importance - a.importance;
        });

        const deduplicated = [];
        const seenNames = new Set();

        for (const item of filtered) {
            const nameLower = item.name.toLowerCase().trim();
            const country = item.raw?.address?.country?.toLowerCase() || '';

            const normalizedName = nameLower
                .replace(/\s+governorate/gi, '')
                .replace(/\s+district/gi, '')
                .replace(/\s+province/gi, '');
            
            const uniqueKey = `${normalizedName}-${country}`;

            let isDuplicate = false;
            
            for (const seenName of seenNames) {

                if (seenName === uniqueKey) {
                    isDuplicate = true;
                    break;
                }

                const [seenBase] = seenName.split('-');
                if (normalizedName.includes(seenBase) || seenBase.includes(normalizedName)) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                seenNames.add(uniqueKey);
                deduplicated.push(item);
            }
        }

        return deduplicated.slice(0, 5);
    }

    #showPopularDestinations(dropdown, onSelect) {
        dropdown.innerHTML = `
            <div class="autocomplete-header">Popular destinations</div>
            ${this.popularDestinations.map(dest => `
                <div class="autocomplete-item" data-value="${this.#escapeHtml(dest.full)}">
                    <div class="autocomplete-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div class="autocomplete-item-text">
                        <div class="autocomplete-item-name">${this.#escapeHtml(dest.name)}</div>
                        <div class="autocomplete-item-location">${this.#escapeHtml(dest.region)}</div>
                    </div>
                </div>
            `).join('')}
        `;

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                onSelect({
                    place_name: item.dataset.value,
                    full_name: item.dataset.value
                });
            });
        });
    }

    #renderAutocompleteResults(dropdown, results, onSelect) {
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-no-results">No locations found</div>';
            return;
        }

        dropdown.innerHTML = results.map(result => `
            <div class="autocomplete-item" data-value="${this.#escapeHtml(result.full_name)}">
                <div class="autocomplete-item-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                </div>
                <div class="autocomplete-item-text">
                    <div class="autocomplete-item-name">${this.#escapeHtml(result.name)}</div>
                    <div class="autocomplete-item-location">${this.#escapeHtml(result.region)}</div>
                </div>
            </div>
        `).join('');

        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                onSelect({
                    place_name: item.dataset.value,
                    full_name: item.dataset.value
                });
            });
        });
    }

    #updateSelectedItem(items, selectedIndex) {
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    #escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    #setupGuestsDropdown() {

        this.#initGuestsCounter({
            input: document.getElementById('guests'),
            dropdown: document.getElementById('guestsDropdown'),
            adultsDisplay: document.getElementById('adultsDisplay'),
            childrenDisplay: document.getElementById('childrenDisplay'),
            adultsCount: document.getElementById('adultsCount'),
            childrenCount: document.getElementById('childrenCount'),
            targetPrefix: ''
        });

        this.#initGuestsCounter({
            input: document.getElementById('navGuests'),
            dropdown: document.getElementById('navGuestsDropdown'),
            adultsDisplay: document.getElementById('navAdultsDisplay'),
            childrenDisplay: document.getElementById('navChildrenDisplay'),
            adultsCount: document.getElementById('navAdultsCount'),
            childrenCount: document.getElementById('navChildrenCount'),
            targetPrefix: 'nav-'
        });
    }

    #initGuestsCounter(config) {
        const { input, dropdown, adultsDisplay, childrenDisplay, adultsCount, childrenCount, targetPrefix } = config;
        
        if (!input || !dropdown) return;

        let adults = 0;
        let children = 0;

        const updateDisplay = () => {
            if (adultsDisplay) adultsDisplay.textContent = adults;
            if (childrenDisplay) childrenDisplay.textContent = children;
            if (adultsCount) adultsCount.value = adults;
            if (childrenCount) childrenCount.value = children;

            const total = adults + children;
            if (total === 0) {
                input.value = '';
                input.placeholder = input.id === 'navGuests' ? 'Guests' : 'Add guests';
            } else {
                const parts = [];
                if (adults > 0) parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
                if (children > 0) parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
                input.value = parts.join(', ');
            }

            updateButtonStates();

            syncWithOther();
        };

        const updateButtonStates = () => {
            const minusAdults = dropdown.querySelector(`[data-target="${targetPrefix}adults"].counter-minus`);
            const minusChildren = dropdown.querySelector(`[data-target="${targetPrefix}children"].counter-minus`);
            
            if (minusAdults) minusAdults.disabled = adults === 0;
            if (minusChildren) minusChildren.disabled = children === 0;
        };

        const syncWithOther = () => {

            if (targetPrefix === '') {

                const navInput = document.getElementById('navGuests');
                const navAdultsDisplay = document.getElementById('navAdultsDisplay');
                const navChildrenDisplay = document.getElementById('navChildrenDisplay');
                const navAdultsCount = document.getElementById('navAdultsCount');
                const navChildrenCount = document.getElementById('navChildrenCount');
                
                if (navInput) navInput.value = input.value;
                if (navAdultsDisplay) navAdultsDisplay.textContent = adults;
                if (navChildrenDisplay) navChildrenDisplay.textContent = children;
                if (navAdultsCount) navAdultsCount.value = adults;
                if (navChildrenCount) navChildrenCount.value = children;
            } else {

                const mainInput = document.getElementById('guests');
                const mainAdultsDisplay = document.getElementById('adultsDisplay');
                const mainChildrenDisplay = document.getElementById('childrenDisplay');
                const mainAdultsCount = document.getElementById('adultsCount');
                const mainChildrenCount = document.getElementById('childrenCount');
                
                if (mainInput) mainInput.value = input.value;
                if (mainAdultsDisplay) mainAdultsDisplay.textContent = adults;
                if (mainChildrenDisplay) mainChildrenDisplay.textContent = children;
                if (mainAdultsCount) mainAdultsCount.value = adults;
                if (mainChildrenCount) mainChildrenCount.value = children;
            }
        };

        const hideDropdown = () => {
            dropdown.classList.remove('active');
        };

        const showDropdown = () => {
            dropdown.classList.add('active');
        };

        input.addEventListener('click', (e) => {
            e.stopPropagation();
            showDropdown();
        });

        dropdown.addEventListener('click', (e) => {
            const btn = e.target.closest('.counter-btn');
            if (!btn) return;
            
            e.stopPropagation();
            
            const target = btn.dataset.target;
            const isPlus = btn.classList.contains('counter-plus');
            
            if (target === `${targetPrefix}adults`) {
                adults = isPlus ? Math.min(adults + 1, 20) : Math.max(adults - 1, 0);
            } else if (target === `${targetPrefix}children`) {
                children = isPlus ? Math.min(children + 1, 20) : Math.max(children - 1, 0);
            }
            
            updateDisplay();
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                hideDropdown();
            }
        });

        updateDisplay();
    }

    #setupDatePickers() {
        if (typeof flatpickr === 'undefined') {
            
            return;
        }

        const today = new Date();

        const datesInput = document.getElementById('dates');
        const checkInInput = document.getElementById('checkIn');
        const checkOutInput = document.getElementById('checkOut');

        const navDatesInput = document.getElementById('navDates');
        const navCheckInInput = document.getElementById('navCheckIn');
        const navCheckOutInput = document.getElementById('navCheckOut');

        const commonConfig = {
            minDate: today,
            dateFormat: "M j",
            mode: "range",
            showMonths: 2,
            disableMobile: true,
            static: false,
            onReady: function(selectedDates, dateStr, instance) {
                instance.calendarContainer.classList.add('rent-that-view-calendar');
            }
        };

        if (datesInput) {
            flatpickr(datesInput, {
                ...commonConfig,
                onChange: (selectedDates, dateStr) => {
                    if (selectedDates.length === 2) {

                        const start = flatpickr.formatDate(selectedDates[0], 'M j');
                        const end = flatpickr.formatDate(selectedDates[1], 'M j');
                        datesInput.value = `${start} - ${end}`;

                        if (checkInInput) checkInInput.value = flatpickr.formatDate(selectedDates[0], 'Y-m-d');
                        if (checkOutInput) checkOutInput.value = flatpickr.formatDate(selectedDates[1], 'Y-m-d');

                        if (navDatesInput) navDatesInput.value = datesInput.value;
                        if (navCheckInInput) navCheckInInput.value = checkInInput.value;
                        if (navCheckOutInput) navCheckOutInput.value = checkOutInput.value;
                    } else if (selectedDates.length === 0) {

                        datesInput.value = '';
                        if (checkInInput) checkInInput.value = '';
                        if (checkOutInput) checkOutInput.value = '';
                        if (navDatesInput) navDatesInput.value = '';
                        if (navCheckInInput) navCheckInInput.value = '';
                        if (navCheckOutInput) navCheckOutInput.value = '';
                    }
                }
            });
        }

        if (navDatesInput) {
            flatpickr(navDatesInput, {
                ...commonConfig,
                onChange: (selectedDates, dateStr) => {
                    if (selectedDates.length === 2) {

                        const start = flatpickr.formatDate(selectedDates[0], 'M j');
                        const end = flatpickr.formatDate(selectedDates[1], 'M j');
                        navDatesInput.value = `${start} - ${end}`;

                        if (navCheckInInput) navCheckInInput.value = flatpickr.formatDate(selectedDates[0], 'Y-m-d');
                        if (navCheckOutInput) navCheckOutInput.value = flatpickr.formatDate(selectedDates[1], 'Y-m-d');

                        if (datesInput) datesInput.value = navDatesInput.value;
                        if (checkInInput) checkInInput.value = navCheckInInput.value;
                        if (checkOutInput) checkOutInput.value = navCheckOutInput.value;
                    } else if (selectedDates.length === 0) {
                        navDatesInput.value = '';
                        if (navCheckInInput) navCheckInInput.value = '';
                        if (navCheckOutInput) navCheckOutInput.value = '';
                        if (datesInput) datesInput.value = '';
                        if (checkInInput) checkInInput.value = '';
                        if (checkOutInput) checkOutInput.value = '';
                    }
                }
            });
        }
    }

    #setupCompactNavSearch() {
        console.log('=== setupCompactNavSearch called ===');

        const navSearchWrap = document.getElementById('navSearchCompact');
        const compactForm = document.getElementById('compactSearchForm');
        const mainLocation = document.getElementById('location');
        const mainGuests = document.getElementById('guests');

        const navLocation = document.getElementById('navLocation');
        const navGuests = document.getElementById('navGuests');
        const navbar = document.querySelector('.navbar');

        console.log('Elements found:', {
            navSearchWrap: !!navSearchWrap,
            compactForm: !!compactForm,
            navbar: !!navbar
        });

        if (!navSearchWrap || !compactForm || !navbar) {
            console.error('Missing required elements - exiting setup');
            return;
        }

        console.log('All elements found - continuing setup');

        const syncToMain = () => {
            if (mainLocation && navLocation) mainLocation.value = navLocation.value;
            if (mainGuests && navGuests) mainGuests.value = navGuests.value;

            this.#handleSearch();
        };

        const syncFromMain = () => {
            if (mainLocation && navLocation) navLocation.value = mainLocation.value;
            if (mainGuests && navGuests) navGuests.value = mainGuests.value;

        };

        [mainLocation, mainGuests].forEach(el => {
            if (!el) return;
            const evt = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(evt, syncFromMain);
        });

        compactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const location = document.getElementById('navLocation')?.value || '';
            const checkIn = document.getElementById('navCheckIn')?.value || '';
            const checkOut = document.getElementById('navCheckOut')?.value || '';
            const adultsCount = document.getElementById('navAdultsCount')?.value || '0';
            const childrenCount = document.getElementById('navChildrenCount')?.value || '0';

            const params = new URLSearchParams();
            if (location) params.set('location', location);
            if (checkIn) params.set('checkIn', checkIn);
            if (checkOut) params.set('checkOut', checkOut);
            if (adultsCount !== '0') params.set('adults', adultsCount);
            if (childrenCount !== '0') params.set('children', childrenCount);

            window.location.href = `pages/search-results.html?${params.toString()}`;
        });

        const showOrHide = () => {
            const mainSearchBar = document.querySelector('.main-search-bar');
            if (!mainSearchBar) {
                console.log('Main search bar not found');
                navSearchWrap.classList.remove('is-visible');
                navSearchWrap.setAttribute('aria-hidden', 'true');
                return;
            }

            const searchBarBottom = mainSearchBar.getBoundingClientRect().bottom;
            const navbarHeight = navbar.offsetHeight;
            const scrollY = window.scrollY || window.pageYOffset;

            const shouldShow = searchBarBottom < navbarHeight;

            console.log('Scroll check:', {
                scrollY: scrollY.toFixed(0),
                searchBarBottom: searchBarBottom.toFixed(0),
                navbarHeight,
                shouldShow,
                hasClass: navSearchWrap.classList.contains('is-visible')
            });

            if (shouldShow) {
                navSearchWrap.classList.add('is-visible');
                navSearchWrap.setAttribute('aria-hidden', 'false');
                console.log('SHOWING compact search');
            } else {
                navSearchWrap.classList.remove('is-visible');
                navSearchWrap.setAttribute('aria-hidden', 'true');
                console.log('HIDING compact search');
            }
        };

        setTimeout(() => {
            showOrHide();
        }, 100);

        window.addEventListener('scroll', () => showOrHide());
        window.addEventListener('resize', () => showOrHide());
    }

    #setupEventListeners() {
        const searchForm = document.getElementById('propertySearchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleSearch();
            });
        }

        const locationInput = document.getElementById('location');
        if (locationInput) {
            locationInput.addEventListener('input', this.#debounce(() => {
                this.#handleSearch();
            }, 500));
        }

        const checkInInput = document.getElementById('checkIn');
        const checkOutInput = document.getElementById('checkOut');
        
        if (checkInInput && checkOutInput) {
            checkInInput.addEventListener('change', () => this.#handleSearch());
            checkOutInput.addEventListener('change', () => this.#validateDates());
        }

        const sortSelect = document.getElementById('sortBy');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.#handleSort());
        }

        this.#setupFilterListeners();
    }

    #setupFilterListeners() {
        const filterInputs = document.querySelectorAll('#advancedFilters input, #advancedFilters select');
        filterInputs.forEach(input => {
            const eventType = input.type === 'checkbox' ? 'change' : 'input';
            input.addEventListener(eventType, this.#debounce(() => {
                this.#handleSearch();
            }, 300));
        });
    }

    #setupAdvancedFilters() {
        const filtersToggle = document.getElementById('filtersToggle');
        const filtersPanel = document.getElementById('filtersPanel');
        const clearFilters = document.querySelector('.clear-filters-compact');
        const showResults = document.querySelector('.show-results-compact');
        
        if (filtersToggle && filtersPanel) {
            filtersToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = filtersPanel.style.display !== 'none';
                filtersPanel.style.display = isVisible ? 'none' : 'block';
            });

            document.addEventListener('click', (e) => {
                if (!filtersToggle.contains(e.target) && !filtersPanel.contains(e.target)) {
                    filtersPanel.style.display = 'none';
                }
            });
        }
        
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {

                document.querySelectorAll('#filtersPanel input, #filtersPanel select').forEach(input => {
                    if (input.type === 'checkbox' || input.type === 'radio') {
                        input.checked = false;
                    } else {
                        input.value = '';
                    }
                });
            });
        }
        
        if (showResults) {
            showResults.addEventListener('click', () => {

                filtersPanel.style.display = 'none';
                this.#handleSearch();
            });
        }
    }

    #setupViewControls() {
        const viewButtons = document.querySelectorAll('.view-btn');
        const propertiesGrid = document.getElementById('propertiesGrid');
        
        viewButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                this.currentView = view;

                viewButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (propertiesGrid) {
                    propertiesGrid.classList.toggle('list-view', view === 'list');
                }

                this.#renderProperties();
            });
        });
    }

    #setupCategoryTabs() {
        const categoryTabs = document.querySelectorAll('.category-tab');
        
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');

                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                this.#filterByCategory(category);
            });
        });
    }

    #filterByCategory(category) {
        if (category === 'all') {

            this.currentFilters.viewType = '';
        } else {

            const categoryMap = {
                'mountain': 'Mountain View',
                'ocean': 'Ocean View', 
                'city': 'City Skyline View',
                'countryside': 'Countryside View'
            };
            this.currentFilters.viewType = categoryMap[category] || '';
        }

        this.currentPage = 1;
        this.#loadProperties();
    }

    #setupPagination() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.#goToPage(this.currentPage - 1));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.#goToPage(this.currentPage + 1));
        }
    }

    #handleUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);

        const location = urlParams.get('location');
        const checkIn = urlParams.get('checkin');
        const checkOut = urlParams.get('checkout');
        const guests = urlParams.get('guests');
        const viewType = urlParams.get('view_type');
        const propertyType = urlParams.get('property_type');
        const minPrice = urlParams.get('min_price');
        const maxPrice = urlParams.get('max_price');

        if (location) {
            const locationInput = document.getElementById('location');
            if (locationInput) locationInput.value = location;
        }

        if (checkIn) {
            const checkInInput = document.getElementById('checkIn');
            if (checkInInput) checkInInput.value = checkIn;
        }

        if (checkOut) {
            const checkOutInput = document.getElementById('checkOut');
            if (checkOutInput) checkOutInput.value = checkOut;
        }

        if (guests) {
            const guestsSelect = document.getElementById('guests');
            if (guestsSelect) guestsSelect.value = guests;
        }

        if (viewType) {
            const viewTypeSelect = document.getElementById('viewType');
            if (viewTypeSelect) viewTypeSelect.value = viewType;
        }

        if (propertyType) {
            const propertyTypeSelect = document.getElementById('propertyType');
            if (propertyTypeSelect) propertyTypeSelect.value = propertyType;
        }

        if (minPrice) {
            const minPriceInput = document.getElementById('minPrice');
            if (minPriceInput) minPriceInput.value = minPrice;
        }

        if (maxPrice) {
            const maxPriceInput = document.getElementById('maxPrice');
            if (maxPriceInput) maxPriceInput.value = maxPrice;
        }
    }

    #updateUrl() {
        const formData = this.#getFormData();
        const params = new URLSearchParams();
        
        Object.keys(formData).forEach(key => {
            if (formData[key] && formData[key].length > 0) {
                params.set(key, formData[key]);
            }
        });
        
        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);
    }

    #getFormData() {
        const form = document.getElementById('propertySearchForm');
        if (!form) return {};

        const formData = new FormData(form);
        const data = {};
        
        for (let [key, value] of formData.entries()) {
            if (key === 'amenities') {
                if (!data.amenities) data.amenities = [];
                data.amenities.push(value);
            } else {
                data[key] = value;
            }
        }

        const amenityCheckboxes = form.querySelectorAll('input[name="amenities"]:checked');
        data.amenities = Array.from(amenityCheckboxes).map(cb => cb.value);
        
        return data;
    }

    #validateDates() {
        const checkIn = document.getElementById('checkIn');
        const checkOut = document.getElementById('checkOut');
        
        if (checkIn && checkOut && checkIn.value && checkOut.value) {
            const checkInDate = new Date(checkIn.value);
            const checkOutDate = new Date(checkOut.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (checkInDate < today) {
                checkIn.value = today.toISOString().split('T')[0];
                this.#showNotification('Check-in date cannot be in the past', 'warning');
            }

            if (checkOutDate <= checkInDate) {
                const nextDay = new Date(checkInDate);
                nextDay.setDate(nextDay.getDate() + 1);
                checkOut.value = nextDay.toISOString().split('T')[0];
                this.#showNotification('Check-out date must be after check-in date', 'warning');
            }
        }
        
        this.#handleSearch();
    }

    async #handleSearch() {
        if (this.isLoading) return;

        const location = document.getElementById('location')?.value || '';
        const checkIn = document.getElementById('checkIn')?.value || '';
        const checkOut = document.getElementById('checkOut')?.value || '';
        const adultsCount = document.getElementById('adultsCount')?.value || '0';
        const childrenCount = document.getElementById('childrenCount')?.value || '0';

        const params = new URLSearchParams();
        if (location) params.set('location', location);
        if (checkIn) params.set('checkIn', checkIn);
        if (checkOut) params.set('checkOut', checkOut);
        if (adultsCount !== '0') params.set('adults', adultsCount);
        if (childrenCount !== '0') params.set('children', childrenCount);

        window.location.href = `pages/search-results.html?${params.toString()}`;
    }

    #handleSort() {
        const sortSelect = document.getElementById('sortBy');
        if (!sortSelect) return;
        
        const sortBy = sortSelect.value;
        this.#sortProperties(sortBy);
        this.#renderProperties();
    }

    async #loadProperties() {
        this.#showLoading(true);
        
        try {
            if (!this.supabaseClient.supabase) {

                this.properties = this.#getSampleProperties();
            } else {
                const { data, error } = await this.supabaseClient.supabase
                    .from('properties')
                    .select(`
                        *,
                        property_images(image_url, is_primary),
                        user_profiles(first_name, last_name, profile_image_url),
                        reviews(overall_rating)
                    `)
                    .eq('is_active', true)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                this.properties = data.map(property => this.#processProperty(property));
            }
            
            this.filteredProperties = [...this.properties];
            this.#applyFilters();
            
        } catch (error) {
            
            this.#showError('Failed to load properties. Using sample data.');
            this.properties = this.#getSampleProperties();
            this.filteredProperties = [...this.properties];
            this.#renderProperties();
        } finally {
            this.#showLoading(false);
        }
    }

    #processProperty(property) {

        const ratings = property.reviews || [];
        const avgRating = ratings.length > 0 
            ? ratings.reduce((sum, review) => sum + review.overall_rating, 0) / ratings.length 
            : 0;

        const images = property.property_images || [];
        const primaryImage = images.find(img => img.is_primary) || images[0];
        
        return {
            ...property,
            averageRating: avgRating,
            reviewCount: ratings.length,
            primaryImage: primaryImage?.image_url || null,
            ownerName: property.user_profiles 
                ? `${property.user_profiles.first_name} ${property.user_profiles.last_name}`
                : 'Host',
            images: images.map(img => img.image_url)
        };
    }

    #applyFilters() {
        const filters = this.currentFilters;
        let filtered = [...this.properties];

        if (filters.location) {
            const location = filters.location.toLowerCase();

            const locationParts = location.split(',').map(part => part.trim()).filter(part => part);
            
            filtered = filtered.filter(property => {
                const city = property.city?.toLowerCase() || '';
                const state = property.state?.toLowerCase() || '';
                const country = property.country?.toLowerCase() || '';
                const address = property.address?.toLowerCase() || '';
                const title = property.title?.toLowerCase() || '';

                if (locationParts.length === 1) {

                    const searchTerm = locationParts[0];
                    return city.includes(searchTerm) || 
                           state.includes(searchTerm) || 
                           country.includes(searchTerm) ||
                           address.includes(searchTerm) ||
                           title.includes(searchTerm);
                } else {

                    return locationParts.every((part, index) => {
                        if (index === 0) {

                            return city.includes(part) || address.includes(part) || title.includes(part);
                        } else if (index === 1) {

                            return state.includes(part) || city.includes(part);
                        } else {

                            return country.includes(part);
                        }
                    });
                }
            });
        }

        if (filters.guests) {
            const guestCount = parseInt(filters.guests.replace('+', ''));
            filtered = filtered.filter(property => property.max_guests >= guestCount);
        }

        if (filters.minPrice) {
            const minPrice = parseFloat(filters.minPrice);
            filtered = filtered.filter(property => property.base_price >= minPrice);
        }
        
        if (filters.maxPrice) {
            const maxPrice = parseFloat(filters.maxPrice);
            filtered = filtered.filter(property => property.base_price <= maxPrice);
        }

        if (filters.viewType) {
            filtered = filtered.filter(property => 
                property.view_type.toLowerCase() === filters.viewType.toLowerCase()
            );
        }

        if (filters.propertyType) {
            filtered = filtered.filter(property => 
                property.property_type.toLowerCase() === filters.propertyType.toLowerCase()
            );
        }

        if (filters.amenities && filters.amenities.length > 0) {
            filtered = filtered.filter(property => {
                const propertyAmenities = property.amenities || [];
                return filters.amenities.every(amenity => 
                    propertyAmenities.includes(amenity)
                );
            });
        }

        if (filters.checkIn && filters.checkOut) {

        }
        
        this.filteredProperties = filtered;
        this.#renderProperties();
    }

    #sortProperties(sortBy) {
        switch (sortBy) {
            case 'price_low':
                this.filteredProperties.sort((a, b) => a.base_price - b.base_price);
                break;
            case 'price_high':
                this.filteredProperties.sort((a, b) => b.base_price - a.base_price);
                break;
            case 'rating':
                this.filteredProperties.sort((a, b) => b.averageRating - a.averageRating);
                break;
            case 'newest':
                this.filteredProperties.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                break;
            default: // relevance

                break;
        }
    }

    #renderProperties() {
        const grid = document.getElementById('propertiesGrid');
        if (!grid) return;

        const totalProperties = this.filteredProperties.length;
        const totalPages = Math.ceil(totalProperties / this.propertiesPerPage);
        const startIndex = (this.currentPage - 1) * this.propertiesPerPage;
        const endIndex = startIndex + this.propertiesPerPage;
        const currentProperties = this.filteredProperties.slice(startIndex, endIndex);

        this.#updateResultsCount(totalProperties);

        if (totalProperties === 0) {
            this.#showNoResults();
            return;
        }

        this.#hideNoResults();
        this.#showLoading(false);

        grid.innerHTML = currentProperties.map(property => this.#renderPropertyCard(property)).join('');

        this.#setupPropertyCardListeners();

        this.#updatePagination(totalPages);
    }

    #renderPropertyCard(property) {
        const imageUrl = property.primaryImage || property.images?.[0];
        const isGuestFavorite = this.#isPropertyGuestFavorite(property.id);

        const features = [
            property.bedrooms ? `${property.bedrooms} bed${property.bedrooms > 1 ? 's' : ''}` : null,
            property.bathrooms ? `${property.bathrooms} bath${property.bathrooms > 1 ? 's' : ''}` : null,
            property.max_guests ? `${property.max_guests} guest${property.max_guests > 1 ? 's' : ''}` : null
        ].filter(Boolean).join(' · ');

        return `
            <div class="property-card" data-property-id="${property.id}">
                <div class="property-image-container">
                    ${imageUrl ?
                        `<img src="${imageUrl}" alt="${property.title}" class="property-image">` :
                        `<div class="image-placeholder">Beautiful ${property.view_type} views await</div>`
                    }
                    ${isGuestFavorite ? `<div class="property-badge">Guest favorite</div>` : ''}
                    <button class="property-favorite" data-property-id="${property.id}">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 21s-7.5-4.8-9.6-9.6C1.5 8.6 3.1 6 6 6c1.8 0 3 .9 4 2 1-1.1 2.2-2 4-2 2.9 0 4.5 2.6 3.6 5.4C19.5 16.2 12 21 12 21z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                    </button>
                </div>
                <div class="property-info">
                    <div class="property-header">
                        <div class="property-location">${property.city}, ${property.state}</div>
                        <div class="property-rating">
                            <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                <path d="M15.094 1.346l-4.124 8.341-9.214 1.34 6.669 6.5-1.574 9.176L16 21.854l9.149 4.85-1.574-9.176 6.669-6.5-9.214-1.34z"></path>
                            </svg>
                            <span class="rating-number">${this.#getPropertyRating(property.id)}</span>
                        </div>
                    </div>
                    <div class="property-title">${property.title}</div>
                    <div class="property-details">${features}</div>
                    <div class="property-price">
                        <span class="price-amount">$${property.base_price}</span>
                        <span class="price-period"> per night</span>
                    </div>
                </div>
            </div>
        `;
    }

    #isPropertyGuestFavorite(propertyId) {

        let hash = 0;
        const str = propertyId.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return Math.abs(hash) % 10 < 3;
    }

    #getPropertyRating(propertyId) {

        let hash = 0;
        const str = propertyId.toString() + '_rating';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        const normalizedHash = Math.abs(hash) / 2147483647; // Normalize to 0-1
        const rating = 4.0 + normalizedHash;
        return rating.toFixed(1);
    }

    #setupPropertyCardListeners() {
        const propertyCards = document.querySelectorAll('.property-card');
        const favoriteBtns = document.querySelectorAll('.property-favorite');

        favoriteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.#toggleFavorite(btn);
            });
        });
        
        propertyCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.property-favorite')) {
                    const propertyId = card.getAttribute('data-property-id');
                    // Navigate to property detail page
                    window.location.href = `property-detail.html?id=${propertyId}`;
                }
            });

            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const propertyId = card.getAttribute('data-property-id');
                    // Navigate to property detail page
                    window.location.href = `property-detail.html?id=${propertyId}`;
                }
            });
        });

        const wishlistBtns = document.querySelectorAll('.wishlist-btn');
        wishlistBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const propertyId = btn.getAttribute('data-property-id');
                this.#toggleWishlist(propertyId, btn);
            });
        });
    }

    #toggleFavorite(btn) {
        const isActive = btn.classList.contains('active');
        btn.classList.toggle('active', !isActive);

        btn.style.transform = 'scale(0.8)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 150);

    }

    #showPropertyModal(propertyId) {
        const property = this.properties.find(p => p.id === propertyId);
        if (!property) return;
        
        const modal = document.getElementById('propertyModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');
        
        if (modal && modalTitle && modalBody) {
            modalTitle.textContent = property.title;
            modalBody.innerHTML = this.#renderPropertyModalContent(property);

            this.#initGallery(property.images || []);

            modal.style.display = 'flex';

            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                });
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });

            const handleKeyPress = (e) => {
                if (modal.style.display === 'flex') {
                    if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        this.#prevImage();
                    } else if (e.key === 'ArrowRight') {
                        e.preventDefault();
                        this.#nextImage();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        modal.style.display = 'none';
                    }
                }
            };

            document.removeEventListener('keydown', this.galleryKeyListener);
            this.galleryKeyListener = handleKeyPress;
            document.addEventListener('keydown', this.galleryKeyListener);

            let touchStartX = 0;
            let touchEndX = 0;

            const galleryElement = modal.querySelector('.property-gallery');
            if (galleryElement) {
                galleryElement.addEventListener('touchstart', (e) => {
                    touchStartX = e.changedTouches[0].screenX;
                });

                galleryElement.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    const swipeThreshold = 50;
                    
                    if (touchStartX - touchEndX > swipeThreshold) {

                        this.#nextImage();
                    } else if (touchEndX - touchStartX > swipeThreshold) {

                        this.#prevImage();
                    }
                });
            }
        }
    }

    #renderImageGallery(images, title) {
        if (!images || images.length === 0) return '';

        const sanitizedImages = images.map(img => window.viewVistaApp.sanitizeHTML(img));
        const sanitizedTitle = window.viewVistaApp.sanitizeHTML(title);

        return `
            <div class="property-gallery" style="position: relative; height: 400px; background: #f5f5f5; border-radius: 8px; overflow: hidden;">
                <!-- Main image display -->
                <div class="gallery-main-image" style="height: 100%; position: relative;">
                    <img id="galleryMainImage" 
                         src="${sanitizedImages[0]}" 
                         alt="${sanitizedTitle}" 
                         style="width: 100%; height: 100%; object-fit: cover; display: block;">
                    
                    <!-- Navigation arrows -->
                    ${images.length > 1 ? `
                        <button class="gallery-prev" onclick="window.propertiesManager.prevImage()" 
                                style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); 
                                       background: rgba(0,0,0,0.7); color: white; border: none; 
                                       width: 40px; height: 40px; border-radius: 50%; cursor: pointer; 
                                       display: flex; align-items: center; justify-content: center; font-size: 18px;">
                            ‹
                        </button>
                        <button class="gallery-next" onclick="window.propertiesManager.nextImage()" 
                                style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); 
                                       background: rgba(0,0,0,0.7); color: white; border: none; 
                                       width: 40px; height: 40px; border-radius: 50%; cursor: pointer; 
                                       display: flex; align-items: center; justify-content: center; font-size: 18px;">
                            ›
                        </button>
                    ` : ''}
                    
                    <!-- Image counter -->
                    ${images.length > 1 ? `
                        <div class="gallery-counter" style="position: absolute; bottom: 10px; right: 10px; 
                                                           background: rgba(0,0,0,0.7); color: white; 
                                                           padding: 4px 8px; border-radius: 12px; font-size: 12px;">
                            <span id="galleryCurrentIndex">1</span> / ${images.length}
                        </div>
                    ` : ''}
                </div>
                
                <!-- Thumbnail strip -->
                ${images.length > 1 ? `
                    <div class="gallery-thumbnails" style="position: absolute; bottom: 0; left: 0; right: 0; 
                                                           background: rgba(0,0,0,0.8); padding: 10px; 
                                                           display: flex; gap: 5px; overflow-x: auto;">
                        ${sanitizedImages.map((img, index) => `
                            <img src="${img}" alt="${sanitizedTitle} ${index + 1}" 
                                 onclick="window.propertiesManager.showImage(${index})"
                                 style="width: 60px; height: 40px; object-fit: cover; border-radius: 4px; 
                                        cursor: pointer; opacity: ${index === 0 ? '1' : '0.7'}; 
                                        border: 2px solid ${index === 0 ? 'white' : 'transparent'};" 
                                 data-thumbnail-index="${index}">
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    #renderPropertyModalContent(property) {
        const allImages = property.images || [];
        const hasImages = allImages.length > 0;
        
        return `
            ${hasImages 
                ? this.#renderImageGallery(allImages, property.title)
                : `<div class="image-placeholder" style="height: 300px;">${window.viewVistaApp.sanitizeHTML(property.title)}</div>`
            }
            <div class="modal-property-content">
                <div class="modal-property-header">
                    <div>
                        <h2 class="modal-property-title">${window.viewVistaApp.sanitizeHTML(property.title)}</h2>
                        <p class="modal-property-location">
                            📍 ${property.address 
                                ? window.viewVistaApp.sanitizeHTML(property.address) 
                                : `${window.viewVistaApp.sanitizeHTML(property.city)}, ${window.viewVistaApp.sanitizeHTML(property.state)}, ${window.viewVistaApp.sanitizeHTML(property.country)}`}
                        </p>
                    </div>
                    <div class="modal-property-price">
                        <div class="modal-price">$${property.base_price}</div>
                        <div class="modal-period">/night</div>
                    </div>
                </div>
                
                <div class="modal-property-details">
                    <div class="detail-section">
                        <h4>Property Details</h4>
                        <p><strong>Type:</strong> ${window.viewVistaApp.sanitizeHTML(property.property_type)}</p>
                        <p><strong>View:</strong> ${window.viewVistaApp.sanitizeHTML(property.view_type)}</p>
                        ${property.bedrooms ? `<p><strong>Bedrooms:</strong> ${property.bedrooms}</p>` : ''}
                        ${property.bathrooms ? `<p><strong>Bathrooms:</strong> ${property.bathrooms}</p>` : ''}
                        <p><strong>Max Guests:</strong> ${property.max_guests}</p>
                        ${property.property_size ? `<p><strong>Size:</strong> ${property.property_size} sq ft</p>` : ''}
                    </div>
                    
                    <div class="detail-section">
                        <h4>Description</h4>
                        <p>${window.viewVistaApp.sanitizeHTML(property.description) || 'No description available.'}</p>
                    </div>
                    
                    ${property.amenities && property.amenities.length > 0 ? `
                        <div class="detail-section">
                            <h4>Amenities</h4>
                            <ul>
                                ${property.amenities.map(amenity => `<li>${window.viewVistaApp.sanitizeHTML(amenity)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="detail-section">
                        <h4>Pricing</h4>
                        <p><strong>Base Price:</strong> $${property.base_price}/night</p>
                        ${property.cleaning_fee ? `<p><strong>Cleaning Fee:</strong> $${property.cleaning_fee}</p>` : ''}
                        ${property.min_stay ? `<p><strong>Minimum Stay:</strong> ${property.min_stay} night${property.min_stay > 1 ? 's' : ''}</p>` : ''}
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="document.getElementById('propertyModal').style.display='none'">
                        Close
                    </button>
                    ${this.supabaseClient.isAuthenticated() && this.supabaseClient.getCurrentUser()?.user_metadata?.account_type === 'renter' 
                        ? `<button class="btn btn-primary" onclick="window.propertiesManager.showBookingForm('${property.id}')">Book Now</button>`
                        : this.supabaseClient.isAuthenticated() 
                            ? `<button class="btn btn-secondary" disabled title="Only renters can book properties">Book Now</button>`
                            : `<button class="btn btn-primary" onclick="window.location.href='login.html'">Login to Book</button>`
                    }
                </div>
            </div>
        `;
    }

    async #toggleWishlist(propertyId, button) {
        if (!this.supabaseClient.isAuthenticated()) {
            this.#showNotification('Please sign in to save properties to your wishlist', 'info');
            return;
        }
        
        try {
            const isActive = button.classList.contains('active');
            
            if (isActive) {

                button.classList.remove('active');
                button.innerHTML = '<span>♡</span>';
                this.#showNotification('Removed from wishlist', 'success');
            } else {

                button.classList.add('active');
                button.innerHTML = '<span>♥</span>';
                this.#showNotification('Added to wishlist', 'success');
            }

        } catch (error) {
            
            this.#showNotification('Failed to update wishlist', 'error');
        }
    }

    #goToPage(page) {
        const totalPages = Math.ceil(this.filteredProperties.length / this.propertiesPerPage);
        
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.#renderProperties();

        document.querySelector('.search-results').scrollIntoView({ behavior: 'smooth' });
    }

    #updatePagination(totalPages) {
        const pagination = document.getElementById('pagination');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const paginationNumbers = document.getElementById('paginationNumbers');
        
        if (!pagination) return;

        pagination.style.display = totalPages > 1 ? 'flex' : 'none';
        
        if (totalPages <= 1) return;

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages;
        }

        if (paginationNumbers) {
            paginationNumbers.innerHTML = this.#generatePaginationNumbers(totalPages);

            const pageNumbers = paginationNumbers.querySelectorAll('.pagination-number');
            pageNumbers.forEach(btn => {
                btn.addEventListener('click', () => {
                    const page = parseInt(btn.textContent);
                    this.#goToPage(page);
                });
            });
        }
    }

    #generatePaginationNumbers(totalPages) {
        const maxVisible = 7;
        let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        const numbers = [];

        if (start > 1) {
            numbers.push(`<button class="pagination-number" data-page="1">1</button>`);
            if (start > 2) {
                numbers.push(`<span class="pagination-ellipsis">...</span>`);
            }
        }

        for (let i = start; i <= end; i++) {
            const isActive = i === this.currentPage ? 'active' : '';
            numbers.push(`<button class="pagination-number ${isActive}" data-page="${i}">${i}</button>`);
        }

        if (end < totalPages) {
            if (end < totalPages - 1) {
                numbers.push(`<span class="pagination-ellipsis">...</span>`);
            }
            numbers.push(`<button class="pagination-number" data-page="${totalPages}">${totalPages}</button>`);
        }
        
        return numbers.join('');
    }

    #updateResultsCount(count) {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            const text = count === 0 
                ? 'No properties found'
                : count === 1 
                    ? '1 property found'
                    : `${count} properties found`;
            resultsCount.textContent = text;
        }
    }

    #showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        const propertiesGrid = document.getElementById('propertiesGrid');
        
        this.isLoading = show;
        
        if (loadingState) {
            loadingState.style.display = show ? 'block' : 'none';
        }
        
        if (show && propertiesGrid) {
            propertiesGrid.innerHTML = '<div class="loading-properties" id="loadingState"><div class="loading-spinner"></div><p>Finding amazing properties for you...</p></div>';
        }
    }

    #showNoResults() {
        const noResults = document.getElementById('noResults');
        const pagination = document.getElementById('pagination');
        
        if (noResults) noResults.style.display = 'block';
        if (pagination) pagination.style.display = 'none';
        
        document.getElementById('propertiesGrid').innerHTML = '';
    }

    #hideNoResults() {
        const noResults = document.getElementById('noResults');
        if (noResults) noResults.style.display = 'none';
    }

    #clearFilters() {
        const form = document.getElementById('propertySearchForm');
        if (form) {
            form.reset();
            this.currentFilters = {};
            this.#applyFilters();
            this.#updateUrl();
        }
    }

    #updateAuthUI() {

    }

    async #logSearch(searchData) {
        if (!this.supabaseClient.supabase) return;
        
        try {
            const sessionId = this.#getSessionId();
            
            await this.supabaseClient.supabase
                .from('search_logs')
                .insert([{
                    user_id: this.supabaseClient.user?.id || null,
                    session_id: sessionId,
                    search_query: searchData.location || null,
                    location: searchData.location || null,
                    check_in_date: searchData.checkIn || null,
                    check_out_date: searchData.checkOut || null,
                    num_guests: searchData.guests ? parseInt(searchData.guests.replace('+', '')) : null,
                    price_min: searchData.minPrice ? parseFloat(searchData.minPrice) : null,
                    price_max: searchData.maxPrice ? parseFloat(searchData.maxPrice) : null,
                    property_type: searchData.propertyType || null,
                    amenities: searchData.amenities || [],
                    results_count: this.filteredProperties.length
                }]);
        } catch (error) {
            
        }
    }

    #getSessionId() {
        let sessionId = sessionStorage.getItem('search_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('search_session_id', sessionId);
        }
        return sessionId;
    }

    #showNotification(message, type = 'info') {
        if (window.UI && window.UI.showToast) {
            window.UI.showToast(message, type);
            return;
        }

        const notification = document.createElement('div');
        notification.className = `alert alert-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    #showError(message) {
        this.#showNotification(message, 'error');
    }

    #debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    #showBookingForm(propertyId) {
        const property = this.properties.find(p => p.id === propertyId);
        if (!property) return;

        const bookingModal = this.#createBookingModal(property);
        document.body.appendChild(bookingModal);

        this.#initBookingForm(property);
    }

    #createBookingModal(property) {
        const modal = document.createElement('div');
        modal.id = 'bookingModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        `;

        modal.innerHTML = `
            <div class="booking-modal-content" style="
                background: white;
                border-radius: 12px;
                padding: 0;
                max-width: 500px;
                width: 90%;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            ">
                <div class="booking-header" style="
                    padding: 1.5rem;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 style="margin: 0;">Book ${window.viewVistaApp.sanitizeHTML(property.title)}</h3>
                    <button class="booking-close" style="
                        background: none;
                        border: none;
                        font-size: 1.5rem;
                        cursor: pointer;
                        padding: 0;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">&times;</button>
                </div>
                
                <div class="booking-body" style="padding: 1.5rem;">
                    <form id="bookingForm">
                        <!-- Check-in Date -->
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="checkInDate" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Check-in Date</label>
                            <input type="date" id="checkInDate" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 6px;
                                font-size: 1rem;
                            ">
                        </div>

                        <!-- Check-out Date -->
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="checkOutDate" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Check-out Date</label>
                            <input type="date" id="checkOutDate" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 6px;
                                font-size: 1rem;
                            ">
                        </div>

                        <!-- Number of Guests -->
                        <div class="form-group" style="margin-bottom: 1rem;">
                            <label for="numGuests" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Number of Guests</label>
                            <select id="numGuests" required style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 6px;
                                font-size: 1rem;
                            ">
                                ${Array.from({length: property.max_guests}, (_, i) => 
                                    `<option value="${i + 1}">${i + 1} guest${i + 1 > 1 ? 's' : ''}</option>`
                                ).join('')}
                            </select>
                            <small style="color: #666; font-size: 0.85rem;">Maximum ${property.max_guests} guests</small>
                        </div>

                        <!-- Special Requests -->
                        <div class="form-group" style="margin-bottom: 1.5rem;">
                            <label for="specialRequests" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Special Requests (Optional)</label>
                            <textarea id="specialRequests" rows="3" placeholder="Any special requests or messages for the host..." style="
                                width: 100%;
                                padding: 0.75rem;
                                border: 1px solid #ddd;
                                border-radius: 6px;
                                font-size: 1rem;
                                resize: vertical;
                            "></textarea>
                        </div>

                        <!-- Pricing Summary -->
                        <div class="pricing-summary" style="
                            background: #f8f9fa;
                            padding: 1rem;
                            border-radius: 8px;
                            margin-bottom: 1.5rem;
                        ">
                            <h4 style="margin: 0 0 0.5rem 0;">Pricing Summary</h4>
                            <div class="pricing-breakdown">
                                <div class="pricing-line" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                    <span>$${property.base_price} x <span id="nightCount">0</span> nights</span>
                                    <span id="baseTotal">$0</span>
                                </div>
                                ${property.cleaning_fee ? `
                                    <div class="pricing-line" style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                        <span>Cleaning fee</span>
                                        <span>$${property.cleaning_fee}</span>
                                    </div>
                                ` : ''}
                                <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid #ddd;">
                                <div class="pricing-total" style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                                    <span>Total</span>
                                    <span id="totalAmount">$0</span>
                                </div>
                            </div>
                        </div>

                        <!-- Actions -->
                        <div class="booking-actions" style="display: flex; gap: 1rem;">
                            <button type="button" class="btn btn-secondary booking-cancel" style="flex: 1;">Cancel</button>
                            <button type="submit" class="btn btn-primary" id="submitBooking" style="flex: 2;">Request Booking</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        modal.querySelector('.booking-close').addEventListener('click', () => this.#closeBookingModal());
        modal.querySelector('.booking-cancel').addEventListener('click', () => this.#closeBookingModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.#closeBookingModal();
        });

        return modal;
    }

    #closeBookingModal() {
        const modal = document.getElementById('bookingModal');
        if (modal) {
            modal.remove();
        }
    }

    #initBookingForm(property) {
        const form = document.getElementById('bookingForm');
        const checkInInput = document.getElementById('checkInDate');
        const checkOutInput = document.getElementById('checkOutDate');
        const numGuestsInput = document.getElementById('numGuests');
        const nightCountSpan = document.getElementById('nightCount');
        const baseTotalSpan = document.getElementById('baseTotal');
        const totalAmountSpan = document.getElementById('totalAmount');

        const today = new Date().toISOString().split('T')[0];
        checkInInput.min = today;
        checkOutInput.min = today;

        const updatePricing = () => {
            if (checkInInput.value && checkOutInput.value) {
                const checkIn = new Date(checkInInput.value);
                const checkOut = new Date(checkOutInput.value);
                const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

                if (nights > 0) {
                    const baseTotal = nights * property.base_price;
                    const cleaningFee = property.cleaning_fee || 0;
                    const total = baseTotal + cleaningFee;

                    nightCountSpan.textContent = nights;
                    baseTotalSpan.textContent = `$${baseTotal}`;
                    totalAmountSpan.textContent = `$${total}`;

                    if (property.min_stay && nights < property.min_stay) {
                        checkOutInput.setCustomValidity(`Minimum stay is ${property.min_stay} night${property.min_stay > 1 ? 's' : ''}`);
                    } else {
                        checkOutInput.setCustomValidity('');
                    }
                } else {
                    nightCountSpan.textContent = '0';
                    baseTotalSpan.textContent = '$0';
                    totalAmountSpan.textContent = '$0';
                    checkOutInput.setCustomValidity('Check-out must be after check-in');
                }
            }
        };

        checkInInput.addEventListener('change', () => {
            if (checkInInput.value) {
                const checkInDate = new Date(checkInInput.value);
                checkInDate.setDate(checkInDate.getDate() + 1);
                checkOutInput.min = checkInDate.toISOString().split('T')[0];
                updatePricing();
            }
        });

        checkOutInput.addEventListener('change', updatePricing);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.#submitBooking(property, {
                checkIn: checkInInput.value,
                checkOut: checkOutInput.value,
                guests: parseInt(numGuestsInput.value),
                specialRequests: document.getElementById('specialRequests').value.trim()
            });
        });
    }

    async #submitBooking(property, bookingData) {
        try {
            if (!this.supabaseClient.supabase) {
                this.#showError('Booking system not configured');
                return;
            }

            const user = this.supabaseClient.getCurrentUser();
            if (!user) {
                this.#showError('You must be logged in to make a booking');
                return;
            }

            const submitBtn = document.getElementById('submitBooking');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            const checkIn = new Date(bookingData.checkIn);
            const checkOut = new Date(bookingData.checkOut);
            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
            const baseAmount = nights * property.base_price;
            const cleaningFee = property.cleaning_fee || 0;
            const totalAmount = baseAmount + cleaningFee;

            const { data, error } = await this.supabaseClient.supabase
                .from('bookings')
                .insert([{
                    property_id: property.id,
                    guest_id: user.id,
                    owner_id: property.owner_id,
                    check_in_date: bookingData.checkIn,
                    check_out_date: bookingData.checkOut,
                    num_guests: bookingData.guests,
                    base_amount: baseAmount,
                    cleaning_fee: cleaningFee,
                    service_fee: 0, // Add service fee calculation if needed
                    tax_amount: 0, // Add tax calculation if needed
                    total_amount: totalAmount,
                    special_requests: bookingData.specialRequests || null,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;

            this.#showNotification('Booking request submitted successfully! The property owner will review your request.', 'success');
            this.#closeBookingModal();

            setTimeout(() => {
                if (confirm('Would you like to view your bookings in your dashboard?')) {
                    this.supabaseClient.redirectToDashboard();
                }
            }, 2000);

        } catch (error) {
            
            this.#showError('Failed to submit booking request. Please try again.');
            
            const submitBtn = document.getElementById('submitBooking');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Request Booking';
            }
        }
    }

    #initGallery(images) {
        this.currentGalleryImages = images || [];
        this.currentImageIndex = 0;
    }

    #showImage(index) {
        if (!this.currentGalleryImages || index < 0 || index >= this.currentGalleryImages.length) return;
        
        this.currentImageIndex = index;
        const mainImage = document.getElementById('galleryMainImage');
        const counter = document.getElementById('galleryCurrentIndex');
        
        if (mainImage) {
            mainImage.src = this.currentGalleryImages[index];
        }
        
        if (counter) {
            counter.textContent = index + 1;
        }

        document.querySelectorAll('[data-thumbnail-index]').forEach((thumb, i) => {
            thumb.style.opacity = i === index ? '1' : '0.7';
            thumb.style.border = i === index ? '2px solid white' : '2px solid transparent';
        });
    }

    #nextImage() {
        if (!this.currentGalleryImages) return;
        const nextIndex = (this.currentImageIndex + 1) % this.currentGalleryImages.length;
        this.#showImage(nextIndex);
    }

    #prevImage() {
        if (!this.currentGalleryImages) return;
        const prevIndex = (this.currentImageIndex - 1 + this.currentGalleryImages.length) % this.currentGalleryImages.length;
        this.#showImage(prevIndex);
    }

    #getSampleProperties() {
        return [
            {
                id: 'sample-1',
                title: 'Mountain Vista Cabin',
                description: 'A cozy cabin with breathtaking mountain views. Perfect for a peaceful getaway with hiking trails right outside your door.',
                property_type: 'cabin',
                view_type: 'mountain',
                address: '123 Mountain View Road',
                city: 'Aspen',
                state: 'Colorado',
                country: 'United States',
                bedrooms: 2,
                bathrooms: 1.5,
                max_guests: 4,
                base_price: 150,
                currency: 'USD',
                cleaning_fee: 50,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'fireplace'],
                is_active: true,
                featured: true,
                averageRating: 4.8,
                reviewCount: 23,
                primaryImage: null,
                images: [],
                created_at: '2024-01-15T00:00:00Z'
            },
            {
                id: 'sample-2',
                title: 'Ocean View Apartment',
                description: 'Modern apartment with stunning ocean views. Wake up to the sound of waves and enjoy spectacular sunsets from your private balcony.',
                property_type: 'apartment',
                view_type: 'ocean',
                address: '456 Coastal Highway',
                city: 'Malibu',
                state: 'California',
                country: 'United States',
                bedrooms: 1,
                bathrooms: 1,
                max_guests: 2,
                base_price: 250,
                currency: 'USD',
                cleaning_fee: 75,
                min_stay: 3,
                amenities: ['wifi', 'pool', 'kitchen', 'balcony'],
                is_active: true,
                featured: false,
                averageRating: 4.9,
                reviewCount: 15,
                primaryImage: null,
                images: [],
                created_at: '2024-01-10T00:00:00Z'
            },
            {
                id: 'sample-3',
                title: 'City Skyline Loft',
                description: 'Industrial loft with panoramic city views. Located in the heart of downtown with easy access to restaurants and entertainment.',
                property_type: 'loft',
                view_type: 'city',
                address: '789 Downtown Street',
                city: 'New York',
                state: 'New York',
                country: 'United States',
                bedrooms: 1,
                bathrooms: 1,
                max_guests: 3,
                base_price: 300,
                currency: 'USD',
                cleaning_fee: 100,
                min_stay: 1,
                amenities: ['wifi', 'gym', 'kitchen', 'rooftop'],
                is_active: true,
                featured: false,
                averageRating: 4.6,
                reviewCount: 31,
                primaryImage: null,
                images: [],
                created_at: '2024-01-05T00:00:00Z'
            },
            {
                id: 'sample-4',
                title: 'Forest Retreat House',
                description: 'Secluded house surrounded by ancient trees. Perfect for nature lovers seeking tranquility and fresh air.',
                property_type: 'house',
                view_type: 'forest',
                address: '321 Forest Lane',
                city: 'Portland',
                state: 'Oregon',
                country: 'United States',
                bedrooms: 3,
                bathrooms: 2,
                max_guests: 6,
                base_price: 200,
                currency: 'USD',
                cleaning_fee: 80,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'petFriendly'],
                is_active: true,
                featured: true,
                averageRating: 4.7,
                reviewCount: 18,
                primaryImage: null,
                images: [],
                created_at: '2024-01-12T00:00:00Z'
            },
            {
                id: 'sample-5',
                title: 'Lake House Villa',
                description: 'Luxurious villa overlooking a pristine lake. Features private dock and stunning sunrise views.',
                property_type: 'villa',
                view_type: 'lake',
                address: '654 Lakeshore Drive',
                city: 'Lake Tahoe',
                state: 'California',
                country: 'United States',
                bedrooms: 4,
                bathrooms: 3,
                max_guests: 8,
                base_price: 400,
                currency: 'USD',
                cleaning_fee: 150,
                min_stay: 3,
                amenities: ['wifi', 'parking', 'kitchen', 'pool', 'dock'],
                is_active: true,
                featured: true,
                averageRating: 4.9,
                reviewCount: 27,
                primaryImage: null,
                images: [],
                created_at: '2024-01-08T00:00:00Z'
            },
            {
                id: 'sample-6',
                title: 'Countryside Cottage',
                description: 'Charming cottage in rolling hills with panoramic countryside views. Perfect for a romantic getaway.',
                property_type: 'cottage',
                view_type: 'countryside',
                address: '987 Country Road',
                city: 'Napa',
                state: 'California',
                country: 'United States',
                bedrooms: 2,
                bathrooms: 1,
                max_guests: 4,
                base_price: 180,
                currency: 'USD',
                cleaning_fee: 60,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'garden'],
                is_active: true,
                featured: false,
                averageRating: 4.5,
                reviewCount: 12,
                primaryImage: null,
                images: [],
                created_at: '2024-01-20T00:00:00Z'
            },
            {
                id: 'sample-7',
                title: 'Lakefront Villa',
                description: 'Luxurious villa with private lake access and stunning water views. Perfect for family gatherings.',
                property_type: 'villa',
                view_type: 'lake',
                address: '321 Lakeside Drive',
                city: 'Lake Tahoe',
                state: 'Nevada',
                country: 'United States',
                bedrooms: 4,
                bathrooms: 3,
                max_guests: 8,
                base_price: 350,
                currency: 'USD',
                cleaning_fee: 100,
                min_stay: 3,
                amenities: ['wifi', 'parking', 'pool', 'kitchen', 'dock'],
                is_active: true,
                featured: true,
                averageRating: 4.9,
                reviewCount: 31,
                primaryImage: null,
                images: [],
                created_at: '2024-01-10T00:00:00Z'
            },
            {
                id: 'sample-8',
                title: 'Downtown Loft',
                description: 'Modern loft in the heart of the city with stunning skyline views. Walking distance to restaurants and attractions.',
                property_type: 'apartment',
                view_type: 'city',
                address: '789 Urban Street',
                city: 'New York',
                state: 'New York',
                country: 'United States',
                bedrooms: 1,
                bathrooms: 1,
                max_guests: 3,
                base_price: 200,
                currency: 'USD',
                cleaning_fee: 75,
                min_stay: 2,
                amenities: ['wifi', 'kitchen', 'gym'],
                is_active: true,
                featured: false,
                averageRating: 4.6,
                reviewCount: 18,
                primaryImage: null,
                images: [],
                created_at: '2024-01-05T00:00:00Z'
            },
            {
                id: 'sample-9',
                title: 'Forest Retreat',
                description: 'Secluded cabin deep in the forest with incredible nature views. Ideal for digital detox and relaxation.',
                property_type: 'cabin',
                view_type: 'forest',
                address: '456 Pine Grove',
                city: 'Olympic National Park',
                state: 'Washington',
                country: 'United States',
                bedrooms: 3,
                bathrooms: 2,
                max_guests: 6,
                base_price: 175,
                currency: 'USD',
                cleaning_fee: 65,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'hiking'],
                is_active: true,
                featured: true,
                averageRating: 4.7,
                reviewCount: 26,
                primaryImage: null,
                images: [],
                created_at: '2024-01-12T00:00:00Z'
            },
            {
                id: 'sample-10',
                title: 'Cliffside House',
                description: 'Dramatic house perched on ocean cliffs with unobstructed ocean views. Breathtaking sunsets guaranteed.',
                property_type: 'house',
                view_type: 'ocean',
                address: '654 Cliff Road',
                city: 'Big Sur',
                state: 'California',
                country: 'United States',
                bedrooms: 3,
                bathrooms: 2.5,
                max_guests: 6,
                base_price: 400,
                currency: 'USD',
                cleaning_fee: 120,
                min_stay: 3,
                amenities: ['wifi', 'parking', 'kitchen', 'deck', 'hot_tub'],
                is_active: true,
                featured: true,
                averageRating: 5.0,
                reviewCount: 8,
                primaryImage: null,
                images: [],
                created_at: '2024-01-25T00:00:00Z'
            },
            {
                id: 'sample-11',
                title: 'Mountain Lodge',
                description: 'Rustic lodge with panoramic mountain views. Great for ski trips and mountain adventures.',
                property_type: 'lodge',
                view_type: 'mountain',
                address: '987 Alpine Way',
                city: 'Jackson',
                state: 'Wyoming',
                country: 'United States',
                bedrooms: 5,
                bathrooms: 4,
                max_guests: 10,
                base_price: 300,
                currency: 'USD',
                cleaning_fee: 150,
                min_stay: 4,
                amenities: ['wifi', 'parking', 'kitchen', 'fireplace', 'ski_storage'],
                is_active: true,
                featured: false,
                averageRating: 4.8,
                reviewCount: 35,
                primaryImage: null,
                images: [],
                created_at: '2024-01-02T00:00:00Z'
            },
            {
                id: 'sample-12',
                title: 'Urban Penthouse',
                description: 'Luxury penthouse with 360-degree city views. Premium amenities and rooftop access included.',
                property_type: 'penthouse',
                view_type: 'city',
                address: '123 Skyline Tower',
                city: 'Miami',
                state: 'Florida',
                country: 'United States',
                bedrooms: 2,
                bathrooms: 2,
                max_guests: 4,
                base_price: 450,
                currency: 'USD',
                cleaning_fee: 125,
                min_stay: 3,
                amenities: ['wifi', 'pool', 'kitchen', 'rooftop', 'concierge'],
                is_active: true,
                featured: true,
                averageRating: 4.9,
                reviewCount: 42,
                primaryImage: null,
                images: [],
                created_at: '2024-01-18T00:00:00Z'
            },
            {
                id: 'sample-13',
                title: 'Desert Oasis',
                description: 'Unique desert property with stunning sunrise views. Pool and spa overlooking the vast landscape.',
                property_type: 'villa',
                view_type: 'desert',
                address: '456 Cactus Valley',
                city: 'Scottsdale',
                state: 'Arizona',
                country: 'United States',
                bedrooms: 3,
                bathrooms: 3,
                max_guests: 6,
                base_price: 275,
                currency: 'USD',
                cleaning_fee: 85,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'pool', 'kitchen', 'spa'],
                is_active: true,
                featured: false,
                averageRating: 4.4,
                reviewCount: 19,
                primaryImage: null,
                images: [],
                created_at: '2024-01-22T00:00:00Z'
            },
            {
                id: 'sample-14',
                title: 'River Cabin',
                description: 'Cozy cabin right on the river with fishing access. Perfect for nature lovers and outdoor enthusiasts.',
                property_type: 'cabin',
                view_type: 'river',
                address: '789 Riverside Trail',
                city: 'Bend',
                state: 'Oregon',
                country: 'United States',
                bedrooms: 2,
                bathrooms: 1,
                max_guests: 4,
                base_price: 140,
                currency: 'USD',
                cleaning_fee: 50,
                min_stay: 2,
                amenities: ['wifi', 'parking', 'kitchen', 'fishing', 'kayak'],
                is_active: true,
                featured: false,
                averageRating: 4.6,
                reviewCount: 14,
                primaryImage: null,
                images: [],
                created_at: '2024-01-14T00:00:00Z'
            },
            {
                id: 'sample-15',
                title: 'Vineyard Estate',
                description: 'Elegant estate among rolling vineyards with wine tasting opportunities. Luxury meets countryside charm.',
                property_type: 'estate',
                view_type: 'countryside',
                address: '321 Vineyard Lane',
                city: 'Sonoma',
                state: 'California',
                country: 'United States',
                bedrooms: 4,
                bathrooms: 3.5,
                max_guests: 8,
                base_price: 500,
                currency: 'USD',
                cleaning_fee: 150,
                min_stay: 3,
                amenities: ['wifi', 'parking', 'pool', 'kitchen', 'wine_tasting'],
                is_active: true,
                featured: true,
                averageRating: 4.8,
                reviewCount: 27,
                primaryImage: null,
                images: [],
                created_at: '2024-01-28T00:00:00Z'
            }
        ];
    }
}

window.clearFilters = function() {
    if (window.propertiesManager) {
        window.propertiesManager.clearFilters();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded - pathname:', window.location.pathname);

    const isPropertiesPage = window.location.pathname.includes('properties.html') ||
                            window.location.pathname.endsWith('properties') ||
                            window.location.pathname.endsWith('/') ||
                            window.location.pathname.endsWith('index.html') ||
                            window.location.pathname === '/index.html';

    console.log('Is properties page?', isPropertiesPage);

    if (isPropertiesPage) {
        console.log('Creating PropertiesManager...');
        window.propertiesManager = new PropertiesManager();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PropertiesManager;
}