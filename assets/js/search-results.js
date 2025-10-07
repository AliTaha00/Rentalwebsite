// Search Results Page JavaScript
class SearchResultsManager {
    constructor() {
        this.supabaseClient = window.supabaseClient;
        this.properties = [];
        this.filteredProperties = [];
        this.currentFilters = {};
        this.map = null;
        this.markers = [];
        this.isRendering = false;
        
        // Popular destinations for autocomplete
        this.popularDestinations = [
            { name: 'Paris', region: 'France', full: 'Paris, France' },
            { name: 'New York', region: 'United States', full: 'New York, United States' },
            { name: 'Tokyo', region: 'Japan', full: 'Tokyo, Japan' },
            { name: 'London', region: 'United Kingdom', full: 'London, United Kingdom' },
            { name: 'Barcelona', region: 'Spain', full: 'Barcelona, Spain' },
            { name: 'Dubai', region: 'United Arab Emirates', full: 'Dubai, United Arab Emirates' }
        ];
        
        this.init();
    }
    
    async init() {
        // Initialize authentication
        if (this.supabaseClient) {
            await this.supabaseClient.waitForInit();
        }
        
        // Get search parameters from URL
        this.parseURLParams();
        
        // Setup UI components
        this.setupSearchBar();
        this.setupFilters();
        
        // Wait for Google Maps to load before setting up map
        await this.waitForGoogleMaps();
        this.setupMap();
        
        // Load properties
        await this.loadProperties();
    }
    
    waitForGoogleMaps() {
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
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.warn('Google Maps failed to load');
                    resolve();
                }, 10000);
            }
        });
    }
    
    parseURLParams() {
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
        
        // Populate search bar with parameters
        this.populateSearchBar();
    }
    
    populateSearchBar() {
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
            searchDates.value = `${this.formatDate(checkIn)} - ${this.formatDate(checkOut)}`;
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
        
        // Update displays
        const searchAdultsDisplay = document.getElementById('searchAdultsDisplay');
        const searchChildrenDisplay = document.getElementById('searchChildrenDisplay');
        if (searchAdultsDisplay) searchAdultsDisplay.textContent = adults;
        if (searchChildrenDisplay) searchChildrenDisplay.textContent = children;
    }
    
    formatDate(date) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[date.getMonth()]} ${date.getDate()}`;
    }
    
    setupSearchBar() {
        // Setup date picker
        this.setupDatePicker();
        
        // Setup location autocomplete
        this.setupLocationAutocomplete();
        
        // Setup guests counter
        this.setupGuestsCounter();
        
        // Handle search form submission
        const searchForm = document.getElementById('searchResultsForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSearch();
            });
        }
    }
    
    setupDatePicker() {
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
                    const start = this.formatDate(selectedDates[0]);
                    const end = this.formatDate(selectedDates[1]);
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
        
        // Set initial dates if provided
        if (this.currentFilters.checkIn && this.currentFilters.checkOut) {
            if (searchCheckIn) searchCheckIn.value = this.currentFilters.checkIn;
            if (searchCheckOut) searchCheckOut.value = this.currentFilters.checkOut;
        }
    }
    
    setupLocationAutocomplete() {
        const input = document.getElementById('searchLocation');
        const dropdown = document.getElementById('searchLocationAutocomplete');
        
        if (!input || !dropdown) return;
        
        let debounceTimer;
        let selectedIndex = -1;
        
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
            hideDropdown();
        };
        
        // Show popular destinations on focus
        input.addEventListener('focus', () => {
            if (input.value.trim() === '') {
                this.showPopularDestinations(dropdown, onSelect);
                showDropdown();
            }
        });
        
        // Handle input
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            clearTimeout(debounceTimer);
            
            if (query.length === 0) {
                this.showPopularDestinations(dropdown, onSelect);
                showDropdown();
                return;
            }
            
            if (query.length < 2) {
                hideDropdown();
                return;
            }
            
            debounceTimer = setTimeout(async () => {
                await this.searchLocations(query, dropdown, onSelect);
            }, 300);
        });
        
        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                hideDropdown();
            }
        });
    }
    
    showPopularDestinations(dropdown, onSelect) {
        dropdown.innerHTML = `
            <div class="autocomplete-header">Popular destinations</div>
            ${this.popularDestinations.map(dest => `
                <div class="autocomplete-item" data-value="${this.escapeHtml(dest.full)}">
                    <div class="autocomplete-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div class="autocomplete-item-text">
                        <div class="autocomplete-item-name">${this.escapeHtml(dest.name)}</div>
                        <div class="autocomplete-item-location">${this.escapeHtml(dest.region)}</div>
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
    
    async searchLocations(query, dropdown, onSelect) {
        dropdown.innerHTML = '<div class="autocomplete-loading">Searching...</div>';
        dropdown.classList.add('active');
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?` +
                `format=json&q=${encodeURIComponent(query)}&limit=15&featuretype=city&addressdetails=1`
            );
            
            if (!response.ok) throw new Error('Search failed');
            
            const data = await response.json();
            const filtered = this.filterAndDeduplicateResults(data);
            this.renderAutocompleteResults(filtered, dropdown, onSelect);
        } catch (error) {
            console.error('Location search error:', error);
            dropdown.innerHTML = '<div class="autocomplete-no-results">Search failed. Please try again.</div>';
        }
    }
    
    filterAndDeduplicateResults(results) {
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
    
    renderAutocompleteResults(results, dropdown, onSelect) {
        if (results.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-no-results">No locations found</div>';
            return;
        }
        
        dropdown.innerHTML = results.map(item => {
            const name = item.name || 'Unknown';
            const region = item.address?.state || item.address?.country || '';
            const fullName = region ? `${name}, ${region}` : name;
            
            return `
                <div class="autocomplete-item" data-value="${this.escapeHtml(fullName)}" data-raw='${JSON.stringify({
                    name,
                    region,
                    lat: item.lat,
                    lon: item.lon
                })}'>
                    <div class="autocomplete-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                    </div>
                    <div class="autocomplete-item-text">
                        <div class="autocomplete-item-name">${this.escapeHtml(name)}</div>
                        <div class="autocomplete-item-location">${this.escapeHtml(region)}</div>
                    </div>
                </div>
            `;
        }).join('');
        
        dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                onSelect({
                    place_name: item.dataset.value,
                    full_name: item.dataset.value
                });
            });
        });
    }
    
    setupGuestsCounter() {
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
    
    setupFilters() {
        // Toggle filters panel
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
        
        // Amenity icon buttons
        document.querySelectorAll('.amenity-icon-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.toggle('active');
            });
        });
        
        // Type of place toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        
        // Price range sliders
        this.setupPriceSliders();
        
        // Apply filters
        const applyFilters = document.getElementById('applyFilters');
        if (applyFilters) {
            applyFilters.addEventListener('click', () => {
                this.applyFiltersFromPanel();
                closeFilters();
            });
        }
        
        // Clear filters
        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
        
        // Toggle map
        const mapToggle = document.getElementById('mapToggle');
        const mapSection = document.getElementById('mapSection');
        const contentWrapper = document.querySelector('.content-wrapper');
        
        if (mapToggle) {
            mapToggle.addEventListener('click', () => {
                mapToggle.classList.toggle('active');
                mapSection.classList.toggle('active');
                contentWrapper.classList.toggle('map-active');
                
                if (mapToggle.classList.contains('active')) {
                    mapToggle.innerHTML = `
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                            <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 0 0 1 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z"/>
                        </svg>
                        Show list
                    `;
                    // Trigger resize for Google Maps
                    if (this.map) {
                        google.maps.event.trigger(this.map, 'resize');
                        // Re-fit bounds if there are markers
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
                    mapToggle.innerHTML = `
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                            <path d="M15.817.113A.5.5 0 0 1 16 .5v14a.5.5 0 0 1-.402.49l-5 1a.502.502 0 0 1-.196 0L5.5 15.01l-4.902.98A.5.5 0 0 1 0 15.5v-14a.5.5 0 0 1 .402-.49l5-1a.5.5 0 0 1 .196 0L10.5.99l4.902-.98a.5.5 0 0 1 .415.103zM10 1.91l-4-.8v12.98l4 .8V1.91zm1 12.98 4-.8V1.11l-4 .8v12.98zm-6-.8V1.11l-4 .8v12.98l4-.8z"></path>
                        </svg>
                        Show map
                    `;
                }
            });
        }
        
        // Populate filters from URL params
        this.populateFiltersFromParams();
    }
    
    setupPriceSliders() {
        const minSlider = document.getElementById('minPriceSlider');
        const maxSlider = document.getElementById('maxPriceSlider');
        const minDisplay = document.getElementById('minPriceDisplay');
        const maxDisplay = document.getElementById('maxPriceDisplay');
        
        if (!minSlider || !maxSlider) return;
        
        const updateSliders = () => {
            let minVal = parseInt(minSlider.value);
            let maxVal = parseInt(maxSlider.value);
            
            // Ensure min doesn't exceed max
            if (minVal > maxVal - 50) {
                minVal = maxVal - 50;
                minSlider.value = minVal;
            }
            
            // Ensure max doesn't go below min
            if (maxVal < minVal + 50) {
                maxVal = minVal + 50;
                maxSlider.value = maxVal;
            }
            
            if (minDisplay) minDisplay.textContent = minVal;
            if (maxDisplay) maxDisplay.textContent = maxVal >= 1000 ? '1000+' : maxVal;
        };
        
        minSlider.addEventListener('input', updateSliders);
        maxSlider.addEventListener('input', updateSliders);
        
        // Initialize displays
        updateSliders();
    }
    
    populateFiltersFromParams() {
        // Set price sliders
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
        
        // Amenity icon buttons
        if (this.currentFilters.amenities && this.currentFilters.amenities.length > 0) {
            this.currentFilters.amenities.forEach(amenity => {
                const btn = document.querySelector(`.amenity-icon-btn[data-amenity="${amenity}"]`);
                if (btn) btn.classList.add('active');
            });
        }
        
        // Place type toggle
        if (this.currentFilters.placeType) {
            document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
            const typeBtn = document.querySelector(`.toggle-btn[data-type="${this.currentFilters.placeType}"]`);
            if (typeBtn) typeBtn.classList.add('active');
        }
    }
    
    applyFiltersFromPanel() {
        // Get price from sliders
        const minPrice = document.getElementById('minPriceSlider').value;
        const maxPrice = document.getElementById('maxPriceSlider').value;
        
        // Get place type from toggle buttons
        const activeTypeBtn = document.querySelector('.toggle-btn.active');
        const placeType = activeTypeBtn ? activeTypeBtn.dataset.type : '';
        
        const propertyType = document.getElementById('propertyType').value;
        const viewType = document.getElementById('viewType').value;
        const bedrooms = document.getElementById('bedrooms').value;
        const bathrooms = document.getElementById('bathrooms').value;
        
        // Get amenities from icon buttons
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
        
        this.filterProperties();
    }
    
    clearAllFilters() {
        // Clear price sliders
        const minSlider = document.getElementById('minPriceSlider');
        const maxSlider = document.getElementById('maxPriceSlider');
        const minDisplay = document.getElementById('minPriceDisplay');
        const maxDisplay = document.getElementById('maxPriceDisplay');
        
        if (minSlider) minSlider.value = 0;
        if (maxSlider) maxSlider.value = 1000;
        if (minDisplay) minDisplay.textContent = '0';
        if (maxDisplay) maxDisplay.textContent = '1000';
        
        // Clear toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('.toggle-btn[data-type=""]')?.classList.add('active');
        
        // Clear amenity icon buttons
        document.querySelectorAll('.amenity-icon-btn').forEach(btn => btn.classList.remove('active'));
        
        // Clear form inputs
        document.getElementById('propertyType').value = '';
        document.getElementById('viewType').value = '';
        document.getElementById('bedrooms').value = '';
        document.getElementById('bathrooms').value = '';
        
        // Reset filters but keep search params
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
        
        this.filterProperties();
    }
    
    handleSearch() {
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
        
        this.filterProperties();
    }
    
    setupMap() {
        const mapElement = document.getElementById('map');
        if (!mapElement) return;
        
        // Initialize Google Map
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
    
    async loadProperties() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const propertiesGrid = document.getElementById('propertiesGrid');
        
        // Show loading state
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
                .select('*')
                .eq('is_active', true);
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            this.properties = data || [];
            this.filterProperties();
            
        } catch (error) {
            console.error('Error loading properties:', error);
            if (loadingState) {
                loadingState.style.display = 'none';
                loadingState.classList.add('hidden');
            }
            if (emptyState) {
                emptyState.style.display = 'flex';
                emptyState.querySelector('h3').textContent = 'Error loading properties';
                emptyState.querySelector('p').textContent = error.message;
            }
        }
    }
    
    filterProperties() {
        // Prevent concurrent filter operations
        if (this.isRendering) {
            return;
        }
        
        this.isRendering = true;
        
        // Use requestAnimationFrame for smoother updates
        requestAnimationFrame(() => {
            let filtered = [...this.properties];
            const filters = this.currentFilters;
            
            // Location filter
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
            
            // Guest count filter
            const totalGuests = filters.adults + filters.children;
            if (totalGuests > 0) {
                filtered = filtered.filter(property => property.max_guests >= totalGuests);
            }
            
            // View type filter
            if (filters.viewType) {
                filtered = filtered.filter(property => property.view_type === filters.viewType);
            }
            
            // Property type filter
            if (filters.propertyType) {
                filtered = filtered.filter(property => 
                    property.property_type?.toLowerCase() === filters.propertyType.toLowerCase()
                );
            }
            
            // Price filter
            if (filters.minPrice) {
                const minPrice = parseFloat(filters.minPrice);
                filtered = filtered.filter(property => property.base_price >= minPrice);
            }
            
            if (filters.maxPrice) {
                const maxPrice = parseFloat(filters.maxPrice);
                filtered = filtered.filter(property => property.base_price <= maxPrice);
            }
            
            // Bedrooms filter
            if (filters.bedrooms) {
                const minBedrooms = parseInt(filters.bedrooms);
                filtered = filtered.filter(property => property.bedrooms >= minBedrooms);
            }
            
            // Bathrooms filter
            if (filters.bathrooms) {
                const minBathrooms = parseInt(filters.bathrooms);
                filtered = filtered.filter(property => property.bathrooms >= minBathrooms);
            }
            
            // Amenities filter
            if (filters.amenities && filters.amenities.length > 0) {
                filtered = filtered.filter(property => {
                    const propertyAmenities = property.amenities || [];
                    return filters.amenities.every(amenity => 
                        propertyAmenities.includes(amenity)
                    );
                });
            }
            
            this.filteredProperties = filtered;
            this.renderProperties();
            
            // Update map markers after a short delay to prevent interference
            setTimeout(() => {
                this.updateMapMarkers();
                this.isRendering = false;
            }, 100);
        });
    }
    
    renderProperties() {
        const propertiesGrid = document.getElementById('propertiesGrid');
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const resultsCount = document.getElementById('resultsCount');
        
        // Hide loading state immediately
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
            // Create HTML string with all properties
            const html = this.filteredProperties.map(property => 
                this.createPropertyCard(property)
            ).join('');
            
            // Update DOM in one operation
            propertiesGrid.innerHTML = html;
            
            // Force a reflow to ensure all elements are fully rendered
            void propertiesGrid.offsetHeight;
            
            // Add click handlers after a brief delay to ensure rendering is complete
            requestAnimationFrame(() => {
                propertiesGrid.querySelectorAll('.property-card').forEach((card, index) => {
                    card.addEventListener('click', () => {
                        this.viewPropertyDetails(this.filteredProperties[index]);
                    });
                });
            });
        }
    }
    
    createPropertyCard(property) {
        return `
            <div class="property-card" data-id="${property.property_id}">
                <div class="property-image" aria-hidden="true"></div>
                <div class="property-content">
                    <div class="property-header">
                        <p class="property-location">${this.escapeHtml(property.city)}, ${this.escapeHtml(property.country)}</p>
                    </div>
                    <div class="property-type">${this.escapeHtml(property.property_type || 'Property')}</div>
                    <div class="property-details">
                        ${property.bedrooms} bed · ${property.bathrooms} bath · ${property.max_guests} guests
                    </div>
                    <div class="property-footer">
                        <div class="property-price">
                            $${property.base_price} <span>/ night</span>
                        </div>
                        ${property.view_type ? `<div class="property-view-badge">${this.escapeHtml(property.view_type)}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    updateMapMarkers() {
        // Clear existing markers
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
        
        // Add new markers
        validProperties.forEach(property => {
            const position = { 
                lat: parseFloat(property.latitude), 
                lng: parseFloat(property.longitude) 
            };
            
            // Always use regular Marker (simpler and more compatible)
            const marker = new google.maps.Marker({
                map: this.map,
                position: position,
                title: property.title,
                label: {
                    text: `$${property.base_price}`,
                    color: '#1f2937',
                    fontWeight: 'bold',
                    fontSize: '14px'
                },
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 0,
                    fillColor: 'transparent',
                    strokeWeight: 0
                }
            });
            
            this.addMarkerListener(marker, property);
            this.markers.push(marker);
            
            bounds.extend(position);
        });
        
        // Fit map to markers
        if (this.markers.length > 0) {
            this.map.fitBounds(bounds);
            
            // Adjust zoom if only one marker
            if (this.markers.length === 1) {
                this.map.setZoom(14);
            }
        }
    }
    
    addMarkerListener(marker, property) {
        marker.addListener('click', () => {
            const imageUrl = property.images && property.images.length > 0 
                ? property.images[0] 
                : 'https://via.placeholder.com/250x120?text=No+Image';
            
            const contentString = `
                <div class="map-popup">
                    <img src="${imageUrl}" alt="${this.escapeHtml(property.title)}" class="map-popup-image" onerror="this.src='https://via.placeholder.com/250x120?text=No+Image'">
                    <div class="map-popup-content">
                        <div class="map-popup-title">${this.escapeHtml(property.title)}</div>
                        <div class="map-popup-price">$${property.base_price} / night</div>
                    </div>
                </div>
            `;
            
            this.infoWindow.setContent(contentString);
            this.infoWindow.open(this.map, marker);
            
            // Add click listener to popup to view property details
            google.maps.event.addListenerOnce(this.infoWindow, 'domready', () => {
                const popup = document.querySelector('.map-popup');
                if (popup) {
                    popup.style.cursor = 'pointer';
                    popup.addEventListener('click', () => {
                        this.viewPropertyDetails(property);
                    });
                }
            });
        });
    }
    
    viewPropertyDetails(property) {
        window.location.href = `property-details.html?id=${property.property_id}`;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SearchResultsManager();
    });
} else {
    new SearchResultsManager();
}

