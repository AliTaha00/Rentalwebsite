'use strict';

class SearchResultsManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.properties = [];
        this.filteredProperties = [];
        this.currentFilters = {};
        this.map = null;
        this.markers = [];
        this.isRendering = false;

        this.popularDestinations = [
            { name: 'Paris', region: 'France', full: 'Paris, France' },
            { name: 'New York', region: 'United States', full: 'New York, United States' },
            { name: 'Tokyo', region: 'Japan', full: 'Tokyo, Japan' },
            { name: 'London', region: 'United Kingdom', full: 'London, United Kingdom' },
            { name: 'Barcelona', region: 'Spain', full: 'Barcelona, Spain' },
            { name: 'Dubai', region: 'United Arab Emirates', full: 'Dubai, United Arab Emirates' }
        ];

        this.#init();
    }

    async #init() {
        if (this.supabaseClient) {
            await this.supabaseClient.waitForInit();
        }

        this.#parseURLParams();

        this.#setupSearchBar();
        this.#setupFilters();

        await this.#waitForGoogleMaps();
        this.#setupMap();

        await this.#loadProperties();
    }

    #waitForGoogleMaps() {
        return new Promise((resolve) => {
            if (typeof google !== 'undefined' && google.maps) {
                resolve();
            } else {
                const checkInterval = setInterval(() => {
                    if (typeof google !== 'undefined' && google.maps) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    resolve();
                }, 10000);
            }
        });
    }

    #parseURLParams() {
        const params = new URLSearchParams(window.location.search);

        this.currentFilters = {
            location: params.get('location') || '',
            checkIn: params.get('checkIn') || '',
            checkOut: params.get('checkOut') || '',
            adults: parseInt(params.get('adults')) || 0,
            children: parseInt(params.get('children')) || 0,
            viewType: params.get('viewType') || '',
            propertyType: params.get('propertyType') || '',
            placeType: params.get('placeType') || '',
            minPrice: params.get('minPrice') || '',
            maxPrice: params.get('maxPrice') || '',
            bedrooms: params.get('bedrooms') || '',
            bathrooms: params.get('bathrooms') || '',
            amenities: params.get('amenities') ? params.get('amenities').split(',') : []
        };

        this.#populateSearchBar();
    }

    #populateSearchBar() {
        const searchLocation = document.getElementById('searchLocation');
        const searchDates = document.getElementById('searchDates');
        const searchGuests = document.getElementById('searchGuests');
        const searchAdultsCount = document.getElementById('searchAdultsCount');
        const searchChildrenCount = document.getElementById('searchChildrenCount');

        if (searchLocation && this.currentFilters.location) {
            searchLocation.value = this.currentFilters.location;
        }

        if (searchDates && this.currentFilters.checkIn && this.currentFilters.checkOut) {
            const checkIn = new Date(this.currentFilters.checkIn);
            const checkOut = new Date(this.currentFilters.checkOut);
            searchDates.value = `${this.#formatDate(checkIn)} - ${this.#formatDate(checkOut)}`;
        }

        const adults = this.currentFilters.adults;
        const children = this.currentFilters.children;

        if (searchAdultsCount) searchAdultsCount.value = adults;
        if (searchChildrenCount) searchChildrenCount.value = children;

        if (searchGuests && (adults > 0 || children > 0)) {
            const parts = [];
            if (adults > 0) parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
            if (children > 0) parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
            searchGuests.value = parts.join(', ');
        }

        const searchAdultsDisplay = document.getElementById('searchAdultsDisplay');
        const searchChildrenDisplay = document.getElementById('searchChildrenDisplay');
        if (searchAdultsDisplay) searchAdultsDisplay.textContent = adults;
        if (searchChildrenDisplay) searchChildrenDisplay.textContent = children;
    }

    #formatDate(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }

    #setupSearchBar() {
        this.#setupDatePicker();

        this.#setupLocationAutocomplete();

        this.#setupGuestsCounter();

        const searchForm = document.getElementById('searchResultsForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.#handleSearch();
            });
        }
    }

    #setupDatePicker() {
        const searchDates = document.getElementById('searchDates');
        const searchCheckIn = document.getElementById('searchCheckIn');
        const searchCheckOut = document.getElementById('searchCheckOut');

        if (!searchDates) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        flatpickr(searchDates, {
            minDate: today,
            dateFormat: "M j",
            mode: "range",
            showMonths: 2,
            disableMobile: true,
            static: false,
            onReady: function(selectedDates, dateStr, instance) {
                instance.calendarContainer.classList.add('rent-that-view-calendar');
            },
            onChange: (selectedDates, dateStr) => {
                if (selectedDates.length === 2) {
                    const start = this.#formatDate(selectedDates[0]);
                    const end = this.#formatDate(selectedDates[1]);
                    searchDates.value = `${start} - ${end}`;

                    if (searchCheckIn) searchCheckIn.value = flatpickr.formatDate(selectedDates[0], 'Y-m-d');
                    if (searchCheckOut) searchCheckOut.value = flatpickr.formatDate(selectedDates[1], 'Y-m-d');

                    this.currentFilters.checkIn = searchCheckIn.value;
                    this.currentFilters.checkOut = searchCheckOut.value;
                } else if (selectedDates.length === 0) {
                    searchDates.value = '';
                    if (searchCheckIn) searchCheckIn.value = '';
                    if (searchCheckOut) searchCheckOut.value = '';
                    this.currentFilters.checkIn = '';
                    this.currentFilters.checkOut = '';
                }
            }
        });

        if (this.currentFilters.checkIn && this.currentFilters.checkOut) {
            if (searchCheckIn) searchCheckIn.value = this.currentFilters.checkIn;
            if (searchCheckOut) searchCheckOut.value = this.currentFilters.checkOut;
        }
    }

    #setupLocationAutocomplete() {
        const input = document.getElementById('searchLocation');
        const dropdown = document.getElementById('searchLocationAutocomplete');

        if (!input || !dropdown) return;

        let debounceTimer;
        let selectedIndex = -1;

        const clearBtn = document.getElementById('clearSearchLocation');

        const updateClearButton = () => {
            if (clearBtn) {
                clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
            }
        };

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
                this.currentFilters.location = '';
                updateClearButton();
                hideDropdown();
                input.focus();
            });
        }

        updateClearButton();

        const hideDropdown = () => {
            dropdown.classList.remove('active');
            selectedIndex = -1;
        };

        const showDropdown = () => {
            dropdown.classList.add('active');
        };

        const onSelect = (item) => {
            input.value = item.place_name || item.full_name;
            this.currentFilters.location = input.value;
            updateClearButton();
            hideDropdown();
        };

        input.addEventListener('focus', () => {
            if (input.value.trim() === '') {
                this.#showPopularDestinations(dropdown, onSelect);
                showDropdown();
            }
        });

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            updateClearButton();

            clearTimeout(debounceTimer);

            if (query.length === 0) {
                this.#showPopularDestinations(dropdown, onSelect);
                showDropdown();
                return;
            }

            if (query.length < 2) {
                hideDropdown();
                return;
            }

            debounceTimer = setTimeout(async () => {
                await this.#searchLocations(query, dropdown, onSelect);
            }, 300);
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                hideDropdown();
            }
        });
    }

    #showPopularDestinations(dropdown, onSelect) {
        const container = document.createElement('div');

        const header = document.createElement('div');
        header.className = 'autocomplete-header';
        header.textContent = 'Popular destinations';
        container.appendChild(header);

        this.popularDestinations.forEach(dest => {
            const item = document.createElement('div');
            item.className = 'autocomplete-item';
            item.dataset.value = dest.full;

            const icon = document.createElement('div');
            icon.className = 'autocomplete-item-icon';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z');
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '10');
            circle.setAttribute('r', '3');
            svg.appendChild(path1);
            svg.appendChild(circle);
            icon.appendChild(svg);

            const textDiv = document.createElement('div');
            textDiv.className = 'autocomplete-item-text';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'autocomplete-item-name';
            nameDiv.textContent = dest.name;

            const locationDiv = document.createElement('div');
            locationDiv.className = 'autocomplete-item-location';
            locationDiv.textContent = dest.region;

            textDiv.appendChild(nameDiv);
            textDiv.appendChild(locationDiv);

            item.appendChild(icon);
            item.appendChild(textDiv);

            item.addEventListener('click', () => {
                onSelect({
                    place_name: item.dataset.value,
                    full_name: item.dataset.value
                });
            });

            container.appendChild(item);
        });

        dropdown.innerHTML = '';
        dropdown.appendChild(container);
    }

    async #searchLocations(query, dropdown, onSelect) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'autocomplete-loading';
        loadingDiv.textContent = 'Searching...';
        dropdown.innerHTML = '';
        dropdown.appendChild(loadingDiv);
        dropdown.classList.add('active');

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&q=${encodeURIComponent(query)}&limit=15&featuretype=city&addressdetails=1`
            );

            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            const filtered = this.#filterAndDeduplicateResults(data);
            this.#renderAutocompleteResults(filtered, dropdown, onSelect);
        } catch (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'autocomplete-no-results';
            errorDiv.textContent = 'Search failed. Please try again.';
            dropdown.innerHTML = '';
            dropdown.appendChild(errorDiv);
        }
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
            const country = item.address?.country?.toLowerCase() || '';

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

    #renderAutocompleteResults(results, dropdown, onSelect) {
        if (results.length === 0) {
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'autocomplete-no-results';
            noResultsDiv.textContent = 'No locations found';
            dropdown.innerHTML = '';
            dropdown.appendChild(noResultsDiv);
            return;
        }

        const container = document.createElement('div');

        results.forEach(item => {
            const name = item.name || 'Unknown';
            const region = item.address?.state || item.address?.country || '';
            const fullName = region ? `${name}, ${region}` : name;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'autocomplete-item';
            itemDiv.dataset.value = fullName;

            const icon = document.createElement('div');
            icon.className = 'autocomplete-item-icon';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path1.setAttribute('d', 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z');
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '12');
            circle.setAttribute('cy', '10');
            circle.setAttribute('r', '3');
            svg.appendChild(path1);
            svg.appendChild(circle);
            icon.appendChild(svg);

            const textDiv = document.createElement('div');
            textDiv.className = 'autocomplete-item-text';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'autocomplete-item-name';
            nameDiv.textContent = name;

            const locationDiv = document.createElement('div');
            locationDiv.className = 'autocomplete-item-location';
            locationDiv.textContent = region;

            textDiv.appendChild(nameDiv);
            textDiv.appendChild(locationDiv);

            itemDiv.appendChild(icon);
            itemDiv.appendChild(textDiv);

            itemDiv.addEventListener('click', () => {
                onSelect({
                    place_name: itemDiv.dataset.value,
                    full_name: itemDiv.dataset.value
                });
            });

            container.appendChild(itemDiv);
        });

        dropdown.innerHTML = '';
        dropdown.appendChild(container);
    }

    #setupGuestsCounter() {
        const input = document.getElementById('searchGuests');
        const dropdown = document.getElementById('searchGuestsDropdown');
        const adultsDisplay = document.getElementById('searchAdultsDisplay');
        const childrenDisplay = document.getElementById('searchChildrenDisplay');
        const adultsCount = document.getElementById('searchAdultsCount');
        const childrenCount = document.getElementById('searchChildrenCount');

        if (!input || !dropdown) return;

        let adults = this.currentFilters.adults || 0;
        let children = this.currentFilters.children || 0;

        const updateDisplay = () => {
            if (adultsDisplay) adultsDisplay.textContent = adults;
            if (childrenDisplay) childrenDisplay.textContent = children;
            if (adultsCount) adultsCount.value = adults;
            if (childrenCount) childrenCount.value = children;

            const total = adults + children;
            if (total === 0) {
                input.value = '';
                input.placeholder = 'Guests';
            } else {
                const parts = [];
                if (adults > 0) parts.push(`${adults} adult${adults !== 1 ? 's' : ''}`);
                if (children > 0) parts.push(`${children} child${children !== 1 ? 'ren' : ''}`);
                input.value = parts.join(', ');
            }

            this.currentFilters.adults = adults;
            this.currentFilters.children = children;

            updateButtonStates();
        };

        const updateButtonStates = () => {
            const minusAdults = dropdown.querySelector('[data-target="search-adults"].counter-minus');
            const minusChildren = dropdown.querySelector('[data-target="search-children"].counter-minus');

            if (minusAdults) minusAdults.disabled = adults === 0;
            if (minusChildren) minusChildren.disabled = children === 0;
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

            if (target === 'search-adults') {
                adults = isPlus ? Math.min(adults + 1, 20) : Math.max(adults - 1, 0);
            } else if (target === 'search-children') {
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

    #setupFilters() {
        const filtersToggle = document.getElementById('filtersToggle');
        const filtersPanel = document.getElementById('filtersPanel');
        const filtersClose = document.getElementById('filtersClose');
        const filtersBackdrop = document.getElementById('filtersBackdrop');

        const openFilters = () => {
            filtersPanel.classList.add('active');
            filtersBackdrop.classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        const closeFilters = () => {
            filtersPanel.classList.remove('active');
            filtersBackdrop.classList.remove('active');
            document.body.style.overflow = '';
        };

        if (filtersToggle) {
            filtersToggle.addEventListener('click', openFilters);
        }

        if (filtersClose) {
            filtersClose.addEventListener('click', closeFilters);
        }

        if (filtersBackdrop) {
            filtersBackdrop.addEventListener('click', closeFilters);
        }

        document.querySelectorAll('.amenity-icon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });
        });

        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        this.#setupPriceSliders();

        const applyFilters = document.getElementById('applyFilters');
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.#applyFiltersFromPanel();
                closeFilters();
            });
        }

        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.#clearAllFilters();
            });
        }

        const mapToggle = document.getElementById('mapToggle');
        const mapSection = document.getElementById('mapSection');
        const contentWrapper = document.querySelector('.content-wrapper');

        if (mapToggle) {
            mapToggle.addEventListener('click', () => {
                mapToggle.classList.toggle('active');
                mapSection.classList.toggle('active');
                contentWrapper.classList.toggle('map-active');

                if (mapToggle.classList.contains('active')) {
                    const svg1 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg1.setAttribute('viewBox', '0 0 16 16');
                    svg1.setAttribute('width', '16');
                    svg1.setAttribute('height', '16');
                    svg1.setAttribute('fill', 'currentColor');
                    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path1.setAttribute('d', 'M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 0 0 1 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z');
                    svg1.appendChild(path1);
                    const text1 = document.createTextNode(' Show list');
                    mapToggle.innerHTML = '';
                    mapToggle.appendChild(svg1);
                    mapToggle.appendChild(text1);

                    if (this.map) {
                        google.maps.event.trigger(this.map, 'resize');
                        if (this.markers.length > 0) {
                            const bounds = new google.maps.LatLngBounds();
                            this.markers.forEach(marker => {
                                const position = marker.getPosition ? marker.getPosition() : marker.position;
                                if (position) bounds.extend(position);
                            });
                            this.map.fitBounds(bounds);
                        }
                    }
                } else {
                    const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg2.setAttribute('viewBox', '0 0 16 16');
                    svg2.setAttribute('width', '16');
                    svg2.setAttribute('height', '16');
                    svg2.setAttribute('fill', 'currentColor');
                    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path2.setAttribute('d', 'M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.502.502 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98 4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z');
                    svg2.appendChild(path2);
                    const text2 = document.createTextNode(' Show map');
                    mapToggle.innerHTML = '';
                    mapToggle.appendChild(svg2);
                    mapToggle.appendChild(text2);
                }
            });
        }

        this.#populateFiltersFromParams();
    }

    #setupPriceSliders() {
        const minSlider = document.getElementById('minPriceSlider');
        const maxSlider = document.getElementById('maxPriceSlider');
        const minDisplay = document.getElementById('minPriceDisplay');
        const maxDisplay = document.getElementById('maxPriceDisplay');

        if (!minSlider || !maxSlider) return;

        const updateSliders = () => {
            let minVal = parseInt(minSlider.value);
            let maxVal = parseInt(maxSlider.value);

            if (minVal > maxVal - 50) {
                minVal = maxVal - 50;
                minSlider.value = minVal;
            }

            if (maxVal < minVal + 50) {
                maxVal = minVal + 50;
                maxSlider.value = maxVal;
            }

            if (minDisplay) minDisplay.textContent = minVal;
            if (maxDisplay) maxDisplay.textContent = maxVal >= 1000 ? '1000+' : maxVal;
        };

        minSlider.addEventListener('input', updateSliders);
        maxSlider.addEventListener('input', updateSliders);

        updateSliders();
    }

    #populateFiltersFromParams() {
        if (this.currentFilters.minPrice) {
            const minSlider = document.getElementById('minPriceSlider');
            const minDisplay = document.getElementById('minPriceDisplay');
            if (minSlider) minSlider.value = this.currentFilters.minPrice;
            if (minDisplay) minDisplay.textContent = this.currentFilters.minPrice;
        }

        if (this.currentFilters.maxPrice) {
            const maxSlider = document.getElementById('maxPriceSlider');
            const maxDisplay = document.getElementById('maxPriceDisplay');
            if (maxSlider) maxSlider.value = this.currentFilters.maxPrice;
            if (maxDisplay) maxDisplay.textContent = this.currentFilters.maxPrice;
        }

        const fields = ['propertyType', 'viewType', 'bedrooms', 'bathrooms'];

        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && this.currentFilters[field]) {
                element.value = this.currentFilters[field];
            }
        });

        if (this.currentFilters.amenities && this.currentFilters.amenities.length > 0) {
            this.currentFilters.amenities.forEach(amenity => {
                const btn = document.querySelector(`.amenity-icon-btn[data-amenity="${amenity}"]`);
                if (btn) btn.classList.add('active');
            });
        }

        if (this.currentFilters.placeType) {
            document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            const typeBtn = document.querySelector(`.toggle-btn[data-type="${this.currentFilters.placeType}"]`);
            if (typeBtn) typeBtn.classList.add('active');
        }
    }

    #applyFiltersFromPanel() {
        const minPrice = document.getElementById('minPriceSlider').value;
        const maxPrice = document.getElementById('maxPriceSlider').value;

        const activeTypeBtn = document.querySelector('.toggle-btn.active');
        const placeType = activeTypeBtn ? activeTypeBtn.dataset.type : '';

        const propertyType = document.getElementById('propertyType').value;
        const viewType = document.getElementById('viewType').value;
        const bedrooms = document.getElementById('bedrooms').value;
        const bathrooms = document.getElementById('bathrooms').value;

        const amenities = Array.from(document.querySelectorAll('.amenity-icon-btn.active'))
            .map(btn => btn.dataset.amenity);

        this.currentFilters = {
            ...this.currentFilters,
            minPrice: minPrice > 0 ? minPrice : '',
            maxPrice: maxPrice < 1000 ? maxPrice : '',
            placeType,
            propertyType,
            viewType,
            bedrooms,
            bathrooms,
            amenities
        };

        this.#filterProperties();
    }

    #clearAllFilters() {
        const minSlider = document.getElementById('minPriceSlider');
        const maxSlider = document.getElementById('maxPriceSlider');
        const minDisplay = document.getElementById('minPriceDisplay');
        const maxDisplay = document.getElementById('maxPriceDisplay');

        if (minSlider) minSlider.value = 0;
        if (maxSlider) maxSlider.value = 1000;
        if (minDisplay) minDisplay.textContent = '0';
        if (maxDisplay) maxDisplay.textContent = '1000';

        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.toggle-btn[data-type=""]')?.classList.add('active');

        document.querySelectorAll('.amenity-icon-btn').forEach(btn => btn.classList.remove('active'));

        document.getElementById('propertyType').value = '';
        document.getElementById('viewType').value = '';
        document.getElementById('bedrooms').value = '';
        document.getElementById('bathrooms').value = '';

        this.currentFilters = {
            location: this.currentFilters.location,
            checkIn: this.currentFilters.checkIn,
            checkOut: this.currentFilters.checkOut,
            adults: this.currentFilters.adults,
            children: this.currentFilters.children,
            minPrice: '',
            maxPrice: '',
            placeType: '',
            propertyType: '',
            viewType: '',
            bedrooms: '',
            bathrooms: '',
            amenities: []
        };

        this.#filterProperties();
    }

    #handleSearch() {
        const location = document.getElementById('searchLocation').value;
        const checkIn = document.getElementById('searchCheckIn').value;
        const checkOut = document.getElementById('searchCheckOut').value;
        const adults = parseInt(document.getElementById('searchAdultsCount').value) || 0;
        const children = parseInt(document.getElementById('searchChildrenCount').value) || 0;

        this.currentFilters.location = location;
        this.currentFilters.checkIn = checkIn;
        this.currentFilters.checkOut = checkOut;
        this.currentFilters.adults = adults;
        this.currentFilters.children = children;

        this.#filterProperties();
    }

    #setupMap() {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;

        this.map = new google.maps.Map(mapElement, {
            center: { lat: 20, lng: 0 },
            zoom: 2,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        this.infoWindow = new google.maps.InfoWindow();
    }

    async #loadProperties() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const propertiesGrid = document.getElementById('propertiesGrid');

        if (loadingState) {
            loadingState.style.display = 'flex';
            loadingState.classList.remove('hidden');
        }
        if (emptyState) emptyState.style.display = 'none';
        if (propertiesGrid) propertiesGrid.innerHTML = '';

        try {
            if (!this.supabaseClient || !this.supabaseClient.supabase) {
                throw new Error('Database connection not initialized');
            }

            let query = this.supabaseClient.supabase
                .from('properties')
                .select(`
                    *,
                    property_images (
                        id,
                        image_url,
                        display_order
                    )
                `)
                .eq('is_active', true);

            const { data, error } = await query;

            if (error) throw error;

            // Process properties to extract images
            this.properties = (data || []).map(property => {
                // Extract images from property_images relation
                if (property.property_images && property.property_images.length > 0) {
                    property.images = property.property_images
                        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                        .map(img => img.image_url);
                } else {
                    property.images = [];
                }
                return property;
            });

            this.#filterProperties();

        } catch (error) {
            if (loadingState) {
                loadingState.style.display = 'none';
                loadingState.classList.add('hidden');
            }
            if (emptyState) {
                emptyState.style.display = 'flex';
                const h3 = emptyState.querySelector('h3');
                const p = emptyState.querySelector('p');
                if (h3) h3.textContent = 'Error loading properties';
                if (p) p.textContent = error.message;
            }
        }
    }

    #filterProperties() {
        if (this.isRendering) {
            return;
        }

        this.isRendering = true;

        requestAnimationFrame(() => {
            let filtered = [...this.properties];
            const filters = this.currentFilters;

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

            const totalGuests = filters.adults + filters.children;
            if (totalGuests > 0) {
                filtered = filtered.filter(property => property.max_guests >= totalGuests);
            }

            if (filters.viewType) {
                filtered = filtered.filter(property => property.view_type === filters.viewType);
            }

            if (filters.propertyType) {
                filtered = filtered.filter(property =>
                    property.property_type?.toLowerCase() === filters.propertyType.toLowerCase()
                );
            }

            if (filters.minPrice) {
                const minPrice = parseFloat(filters.minPrice);
                filtered = filtered.filter(property => property.base_price >= minPrice);
            }

            if (filters.maxPrice) {
                const maxPrice = parseFloat(filters.maxPrice);
                filtered = filtered.filter(property => property.base_price <= maxPrice);
            }

            if (filters.bedrooms) {
                const minBedrooms = parseInt(filters.bedrooms);
                filtered = filtered.filter(property => property.bedrooms >= minBedrooms);
            }

            if (filters.bathrooms) {
                const minBathrooms = parseInt(filters.bathrooms);
                filtered = filtered.filter(property => property.bathrooms >= minBathrooms);
            }

            if (filters.amenities && filters.amenities.length > 0) {
                filtered = filtered.filter(property => {
                    const propertyAmenities = property.amenities || [];
                    return filters.amenities.every(amenity =>
                        propertyAmenities.includes(amenity)
                    );
                });
            }

            this.filteredProperties = filtered;
            this.#renderProperties();

            setTimeout(() => {
                this.#updateMapMarkers();
                this.isRendering = false;
            }, 100);
        });
    }

    #renderProperties() {
        const propertiesGrid = document.getElementById('propertiesGrid');
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const resultsCount = document.getElementById('resultsCount');

        if (loadingState) {
            loadingState.style.display = 'none';
            loadingState.classList.add('hidden');
        }

        if (this.filteredProperties.length === 0) {
            if (propertiesGrid) propertiesGrid.innerHTML = '';
            if (emptyState) {
                emptyState.style.display = 'flex';
                emptyState.style.opacity = '1';
            }
            if (resultsCount) resultsCount.textContent = 'No properties found';
            return;
        }

        if (emptyState) {
            emptyState.style.display = 'none';
        }

        if (resultsCount) {
            const count = this.filteredProperties.length;
            resultsCount.textContent = `${count} propert${count === 1 ? 'y' : 'ies'} found`;
        }

        if (propertiesGrid) {
            propertiesGrid.innerHTML = '';

            this.filteredProperties.forEach(property => {
                const card = this.#createPropertyCard(property);
                propertiesGrid.appendChild(card);
            });

            void propertiesGrid.offsetHeight;

            requestAnimationFrame(() => {
                propertiesGrid.querySelectorAll('.property-card').forEach((card, index) => {
                    this.#setupPropertyCardInteractions(card, this.filteredProperties[index]);
                });
            });
        }
    }

    #setupPropertyCardInteractions(card, property) {
        const images = JSON.parse(card.dataset.images || '[]');
        let currentImageIndex = 0;

        const wishlistBtn = card.querySelector('.property-card-wishlist');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                wishlistBtn.classList.toggle('active');
            });
        }

        const updateImage = (newIndex) => {
            const allImages = card.querySelectorAll('.property-card-image');
            const allDots = card.querySelectorAll('.property-card-dot');

            allImages.forEach((img, i) => {
                img.classList.toggle('active', i === newIndex);
            });

            allDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === newIndex);
            });

            currentImageIndex = newIndex;
        };

        const leftArrow = card.querySelector('.property-card-arrow-left');
        const rightArrow = card.querySelector('.property-card-arrow-right');

        if (leftArrow) {
            leftArrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIndex = currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
                updateImage(newIndex);
            });
        }

        if (rightArrow) {
            rightArrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIndex = currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;
                updateImage(newIndex);
            });
        }

        card.querySelectorAll('.property-card-dot').forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                updateImage(index);
            });
        });

        if (images.length > 1) {
            const imageContainer = card.querySelector('.property-card-image-container');
            imageContainer.addEventListener('mouseenter', () => {
                if (leftArrow) leftArrow.style.opacity = '1';
                if (rightArrow) rightArrow.style.opacity = '1';
            });

            imageContainer.addEventListener('mouseleave', () => {
                if (leftArrow) leftArrow.style.opacity = '0';
                if (rightArrow) rightArrow.style.opacity = '0';
            });
        }

        card.addEventListener('click', (e) => {
            if (e.target.closest('.property-card-arrow') ||
                e.target.closest('.property-card-dot') ||
                e.target.closest('.property-card-wishlist')) {
                return;
            }
            this.#viewPropertyDetails(property);
        });
    }

    #createPropertyCard(property) {
        const images = property.images && property.images.length > 0
            ? property.images
            : ['https://via.placeholder.com/350x240?text=No+Image'];

        const hasMultipleImages = images.length > 1;

        const card = document.createElement('div');
        card.className = 'property-card';
        card.dataset.id = property.id;
        card.dataset.images = JSON.stringify(images);

        const imageContainer = document.createElement('div');
        imageContainer.className = 'property-card-image-container';

        images.forEach((img, index) => {
            const imgEl = document.createElement('img');
            imgEl.src = img;
            imgEl.alt = this.#sanitize(property.title);
            imgEl.className = `property-card-image ${index === 0 ? 'active' : ''}`;
            imgEl.loading = 'lazy';
            imgEl.onerror = function() { this.src = 'https://via.placeholder.com/350x240?text=No+Image'; };
            imageContainer.appendChild(imgEl);
        });

        const wishlistBtn = document.createElement('button');
        wishlistBtn.className = 'property-card-wishlist';
        wishlistBtn.setAttribute('aria-label', 'Save to wishlist');
        wishlistBtn.title = 'Save';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('fill', 'rgba(0,0,0,0.5)');
        svg.setAttribute('stroke', 'white');
        svg.setAttribute('stroke-width', '2');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M16 28c7-4.733 14-10 14-17a6.98 6.98 0 0 0-7-7c-1.8 0-3.5.973-4.977 2.227L16 8.25l-2.023-2.023C12.5 4.973 10.8 4 9 4a6.98 6.98 0 0 0-7 7c0 7 7 12.267 14 17z');
        svg.appendChild(path);
        wishlistBtn.appendChild(svg);
        imageContainer.appendChild(wishlistBtn);

        if (hasMultipleImages) {
            const leftArrow = document.createElement('button');
            leftArrow.className = 'property-card-arrow property-card-arrow-left';
            leftArrow.setAttribute('aria-label', 'Previous image');
            const svgLeft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgLeft.setAttribute('viewBox', '0 0 24 24');
            svgLeft.setAttribute('width', '12');
            svgLeft.setAttribute('height', '12');
            svgLeft.setAttribute('fill', 'none');
            svgLeft.setAttribute('stroke', 'currentColor');
            svgLeft.setAttribute('stroke-width', '3');
            svgLeft.setAttribute('stroke-linecap', 'round');
            svgLeft.setAttribute('stroke-linejoin', 'round');
            const polylineLeft = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polylineLeft.setAttribute('points', '15 18 9 12 15 6');
            svgLeft.appendChild(polylineLeft);
            leftArrow.appendChild(svgLeft);
            imageContainer.appendChild(leftArrow);

            const rightArrow = document.createElement('button');
            rightArrow.className = 'property-card-arrow property-card-arrow-right';
            rightArrow.setAttribute('aria-label', 'Next image');
            const svgRight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgRight.setAttribute('viewBox', '0 0 24 24');
            svgRight.setAttribute('width', '12');
            svgRight.setAttribute('height', '12');
            svgRight.setAttribute('fill', 'none');
            svgRight.setAttribute('stroke', 'currentColor');
            svgRight.setAttribute('stroke-width', '3');
            svgRight.setAttribute('stroke-linecap', 'round');
            svgRight.setAttribute('stroke-linejoin', 'round');
            const polylineRight = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polylineRight.setAttribute('points', '9 18 15 12 9 6');
            svgRight.appendChild(polylineRight);
            rightArrow.appendChild(svgRight);
            imageContainer.appendChild(rightArrow);

            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'property-card-dots';
            images.forEach((_, index) => {
                const dot = document.createElement('span');
                dot.className = `property-card-dot ${index === 0 ? 'active' : ''}`;
                dot.dataset.index = index;
                dotsContainer.appendChild(dot);
            });
            imageContainer.appendChild(dotsContainer);
        }

        card.appendChild(imageContainer);

        const content = document.createElement('div');
        content.className = 'property-content';

        const header = document.createElement('div');
        header.className = 'property-header';

        const locationP = document.createElement('p');
        locationP.className = 'property-location';
        locationP.textContent = `${this.#sanitize(property.city)}, ${this.#sanitize(property.country)}`;
        header.appendChild(locationP);

        if (property.view_type) {
            const ratingDiv = document.createElement('div');
            ratingDiv.className = 'property-rating';
            ratingDiv.textContent = `★ ${this.#sanitize(property.view_type)}`;
            header.appendChild(ratingDiv);
        }

        content.appendChild(header);

        const typeDiv = document.createElement('div');
        typeDiv.className = 'property-type';
        typeDiv.textContent = this.#sanitize(property.property_type || 'Property');
        content.appendChild(typeDiv);

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'property-details';
        detailsDiv.textContent = `${property.bedrooms} bed · ${property.bathrooms} bath · ${property.max_guests} guests`;
        content.appendChild(detailsDiv);

        const footer = document.createElement('div');
        footer.className = 'property-footer';

        const priceDiv = document.createElement('div');
        priceDiv.className = 'property-price';
        priceDiv.textContent = `$${property.base_price} `;
        const span = document.createElement('span');
        span.textContent = '/ night';
        priceDiv.appendChild(span);
        footer.appendChild(priceDiv);

        content.appendChild(footer);
        card.appendChild(content);

        return card;
    }

    #createCustomMarkerIcon(price) {
        const priceText = `$${price}`;
        const textWidth = priceText.length * 8 + 20;

        const svg = `
            <svg width="${textWidth + 10}" height="40" viewBox="0 0 ${textWidth + 10} 40" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="${textWidth / 2 + 5}" cy="36" rx="${textWidth / 3}" ry="3" fill="rgba(0,0,0,0.15)"/>

                <g filter="url(#shadow)">
                    <rect x="5" y="8" width="${textWidth}" height="24" rx="12"
                          fill="white" stroke="#222" stroke-width="1.5"/>

                    <text x="${textWidth / 2 + 5}" y="21"
                          font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                          font-size="14"
                          font-weight="600"
                          fill="#222"
                          text-anchor="middle"
                          dominant-baseline="middle">${this.#sanitize(priceText)}</text>
                </g>

                <defs>
                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/>
                    </filter>
                </defs>
            </svg>
        `;

        return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(textWidth + 10, 40),
            anchor: new google.maps.Point((textWidth + 10) / 2, 40)
        };
    }

    #updateMapMarkers() {
        this.markers.forEach(marker => {
            if (marker.setMap) {
                marker.setMap(null);
            }
        });
        this.markers = [];

        if (!this.map || typeof google === 'undefined' || !google.maps) return;

        const validProperties = this.filteredProperties.filter(p => p.latitude && p.longitude);

        if (validProperties.length === 0) return;

        const bounds = new google.maps.LatLngBounds();

        validProperties.forEach(property => {
            const position = {
                lat: parseFloat(property.latitude),
                lng: parseFloat(property.longitude)
            };

            const markerIcon = this.#createCustomMarkerIcon(property.base_price);

            const marker = new google.maps.Marker({
                map: this.map,
                position: position,
                title: property.title,
                icon: markerIcon,
                optimized: false
            });

            this.#addMarkerListener(marker, property);
            this.markers.push(marker);

            bounds.extend(position);
        });

        if (this.markers.length > 0) {
            this.map.fitBounds(bounds);

            if (this.markers.length === 1) {
                this.map.setZoom(14);
            }
        }
    }

    #addMarkerListener(marker, property) {
        marker.addListener('click', () => {
            const images = property.images && property.images.length > 0
                ? property.images
                : ['https://via.placeholder.com/320x240?text=No+Image'];

            const hasMultipleImages = images.length > 1;

            const contentDiv = document.createElement('div');
            contentDiv.className = 'map-popup';
            contentDiv.dataset.propertyId = property.id;

            const imageContainer = document.createElement('div');
            imageContainer.className = 'map-popup-image-container';

            images.forEach((img, index) => {
                const imgEl = document.createElement('img');
                imgEl.src = img;
                imgEl.alt = this.#sanitize(property.title);
                imgEl.className = `map-popup-image ${index === 0 ? 'active' : ''}`;
                imgEl.dataset.index = index;
                imgEl.onerror = function() { this.src = 'https://via.placeholder.com/320x240?text=No+Image'; };
                imageContainer.appendChild(imgEl);
            });

            const topIcons = document.createElement('div');
            topIcons.className = 'map-popup-top-icons';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'map-popup-icon-btn map-popup-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.title = 'Close';
            const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            closeSvg.setAttribute('viewBox', '0 0 32 32');
            closeSvg.setAttribute('width', '16');
            closeSvg.setAttribute('height', '16');
            closeSvg.setAttribute('fill', 'none');
            closeSvg.setAttribute('stroke', 'currentColor');
            closeSvg.setAttribute('stroke-width', '3');
            const closePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            closePath.setAttribute('d', 'm6 6 20 20M26 6 6 26');
            closeSvg.appendChild(closePath);
            closeBtn.appendChild(closeSvg);
            topIcons.appendChild(closeBtn);

            const wishlistBtn = document.createElement('button');
            wishlistBtn.className = 'map-popup-icon-btn map-popup-wishlist';
            wishlistBtn.setAttribute('aria-label', 'Save to wishlist');
            wishlistBtn.title = 'Save';
            const wishSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            wishSvg.setAttribute('viewBox', '0 0 32 32');
            wishSvg.setAttribute('width', '16');
            wishSvg.setAttribute('height', '16');
            wishSvg.setAttribute('fill', 'none');
            wishSvg.setAttribute('stroke', 'currentColor');
            wishSvg.setAttribute('stroke-width', '2');
            const wishPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            wishPath.setAttribute('d', 'M16 28c7-4.733 14-10 14-17a6.98 6.98 0 0 0-7-7c-1.8 0-3.5.973-4.977 2.227L16 8.25l-2.023-2.023C12.5 4.973 10.8 4 9 4a6.98 6.98 0 0 0-7 7c0 7 7 12.267 14 17z');
            wishSvg.appendChild(wishPath);
            wishlistBtn.appendChild(wishSvg);
            topIcons.appendChild(wishlistBtn);

            imageContainer.appendChild(topIcons);

            if (hasMultipleImages) {
                const leftArrow = document.createElement('button');
                leftArrow.className = 'map-popup-arrow map-popup-arrow-left';
                leftArrow.setAttribute('aria-label', 'Previous image');
                const svgLeft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svgLeft.setAttribute('viewBox', '0 0 24 24');
                svgLeft.setAttribute('width', '16');
                svgLeft.setAttribute('height', '16');
                svgLeft.setAttribute('fill', 'none');
                svgLeft.setAttribute('stroke', 'currentColor');
                svgLeft.setAttribute('stroke-width', '3');
                svgLeft.setAttribute('stroke-linecap', 'round');
                svgLeft.setAttribute('stroke-linejoin', 'round');
                const polylineLeft = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                polylineLeft.setAttribute('points', '15 18 9 12 15 6');
                svgLeft.appendChild(polylineLeft);
                leftArrow.appendChild(svgLeft);
                imageContainer.appendChild(leftArrow);

                const rightArrow = document.createElement('button');
                rightArrow.className = 'map-popup-arrow map-popup-arrow-right';
                rightArrow.setAttribute('aria-label', 'Next image');
                const svgRight = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svgRight.setAttribute('viewBox', '0 0 24 24');
                svgRight.setAttribute('width', '16');
                svgRight.setAttribute('height', '16');
                svgRight.setAttribute('fill', 'none');
                svgRight.setAttribute('stroke', 'currentColor');
                svgRight.setAttribute('stroke-width', '3');
                svgRight.setAttribute('stroke-linecap', 'round');
                svgRight.setAttribute('stroke-linejoin', 'round');
                const polylineRight = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
                polylineRight.setAttribute('points', '9 18 15 12 9 6');
                svgRight.appendChild(polylineRight);
                rightArrow.appendChild(svgRight);
                imageContainer.appendChild(rightArrow);

                const dotsContainer = document.createElement('div');
                dotsContainer.className = 'map-popup-dots';
                images.forEach((_, index) => {
                    const dot = document.createElement('span');
                    dot.className = `map-popup-dot ${index === 0 ? 'active' : ''}`;
                    dot.dataset.index = index;
                    dotsContainer.appendChild(dot);
                });
                imageContainer.appendChild(dotsContainer);
            }

            contentDiv.appendChild(imageContainer);

            const contentBody = document.createElement('div');
            contentBody.className = 'map-popup-content';

            const headerDiv = document.createElement('div');
            headerDiv.className = 'map-popup-header';

            const locationDiv = document.createElement('div');
            locationDiv.className = 'map-popup-location';
            locationDiv.textContent = `${this.#sanitize(property.property_type || 'Property')} in ${this.#sanitize(property.city)}`;
            headerDiv.appendChild(locationDiv);

            if (property.view_type) {
                const badgeDiv = document.createElement('div');
                badgeDiv.className = 'map-popup-badge';
                badgeDiv.textContent = `★ ${this.#sanitize(property.view_type)}`;
                headerDiv.appendChild(badgeDiv);
            }

            contentBody.appendChild(headerDiv);

            const titleDiv = document.createElement('div');
            titleDiv.className = 'map-popup-title';
            titleDiv.textContent = this.#sanitize(property.title);
            contentBody.appendChild(titleDiv);

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'map-popup-details';
            detailsDiv.textContent = `${property.bedrooms} bed · ${property.bathrooms} bath · ${property.max_guests} guests`;
            contentBody.appendChild(detailsDiv);

            const priceContainer = document.createElement('div');
            priceContainer.className = 'map-popup-price-container';

            const priceSpan = document.createElement('span');
            priceSpan.className = 'map-popup-price';
            priceSpan.textContent = `$${property.base_price}`;
            priceContainer.appendChild(priceSpan);

            const periodSpan = document.createElement('span');
            periodSpan.className = 'map-popup-price-period';
            periodSpan.textContent = `for ${property.booking_days || 5} nights · ${this.#formatDateRange()}`;
            priceContainer.appendChild(periodSpan);

            contentBody.appendChild(priceContainer);
            contentDiv.appendChild(contentBody);

            this.infoWindow.setContent(contentDiv);
            this.infoWindow.open(this.map, marker);

            google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
                this.#setupMapPopupInteractions(property, images);
            });
        });
    }

    #setupMapPopupInteractions(property, images) {
        const popup = document.querySelector('.map-popup');
        if (!popup) return;

        let currentImageIndex = 0;

        const closeBtn = popup.querySelector('.map-popup-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.infoWindow.close();
            });
        }

        const wishlistBtn = popup.querySelector('.map-popup-wishlist');
        if (wishlistBtn) {
            wishlistBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                wishlistBtn.classList.toggle('active');
            });
        }

        const updateImage = (newIndex) => {
            const allImages = popup.querySelectorAll('.map-popup-image');
            const allDots = popup.querySelectorAll('.map-popup-dot');

            allImages.forEach((img, i) => {
                img.classList.toggle('active', i === newIndex);
            });

            allDots.forEach((dot, i) => {
                dot.classList.toggle('active', i === newIndex);
            });

            currentImageIndex = newIndex;
        };

        const leftArrow = popup.querySelector('.map-popup-arrow-left');
        const rightArrow = popup.querySelector('.map-popup-arrow-right');

        if (leftArrow) {
            leftArrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIndex = currentImageIndex === 0 ? images.length - 1 : currentImageIndex - 1;
                updateImage(newIndex);
            });
        }

        if (rightArrow) {
            rightArrow.addEventListener('click', (e) => {
                e.stopPropagation();
                const newIndex = currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;
                updateImage(newIndex);
            });
        }

        popup.querySelectorAll('.map-popup-dot').forEach((dot, index) => {
            dot.addEventListener('click', (e) => {
                e.stopPropagation();
                updateImage(index);
            });
        });

        const content = popup.querySelector('.map-popup-content');
        if (content) {
            content.style.cursor = 'pointer';
            content.addEventListener('click', () => {
                this.#viewPropertyDetails(property);
            });
        }

        const imageContainer = popup.querySelector('.map-popup-image-container');
        if (imageContainer) {
            imageContainer.addEventListener('click', (e) => {
                if (e.target.closest('.map-popup-arrow') ||
                    e.target.closest('.map-popup-dot') ||
                    e.target.closest('.map-popup-icon-btn')) {
                    return;
                }
                this.#viewPropertyDetails(property);
            });
        }
    }

    #formatDateRange() {
        if (this.currentFilters.checkIn && this.currentFilters.checkOut) {
            const checkIn = new Date(this.currentFilters.checkIn);
            const checkOut = new Date(this.currentFilters.checkOut);
            return `${this.#formatDate(checkIn)} - ${this.#formatDate(checkOut)}`;
        }
        return '';
    }

    #viewPropertyDetails(property) {
        window.location.href = `property-detail.html?id=${property.id}`;
    }

    #sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SearchResultsManager();
    });
} else {
    new SearchResultsManager();
}
