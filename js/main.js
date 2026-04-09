document.addEventListener('DOMContentLoaded', function() {
  // Tab functionality for Join Network section
  const tabTriggers = document.querySelectorAll('.tabs-trigger');
  
  // Add click event to each tab trigger
  tabTriggers.forEach(trigger => {
    trigger.addEventListener('click', function() {
      // Get the tab ID from data attribute
      const tabId = this.getAttribute('data-tab');
      
      // Get all tab contents in the same section
      const tabContents = this.closest('section').querySelectorAll('.tab-content');
      
      // Get all tab triggers in the same section
      const sectionTriggers = this.closest('.tabs-list').querySelectorAll('.tabs-trigger');
      
      // Remove active class from all triggers and contents
      sectionTriggers.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked trigger and corresponding content
      this.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Role tabs for How It Works section
  const roleTabs = document.querySelectorAll('.role-tab');
  
  roleTabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const role = this.getAttribute('data-role');
      
      // Remove active class from all tabs and timelines
      roleTabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.timeline-content').forEach(c => {
        c.classList.add('hidden');
        c.classList.remove('active');
      });
      
      // Add active class to clicked tab and corresponding timeline
      this.classList.add('active');
      const timeline = document.getElementById(`${role}-timeline`);
      timeline.classList.remove('hidden');
      timeline.classList.add('active');
    });
  });
  
  // Function to activate a specific timeline tab from hero section buttons
  window.activateTab = function(roleValue, tabType) {
    // Scroll to the how it works section
    const howItWorksSection = document.getElementById('how-it-works');
    if (howItWorksSection) {
      howItWorksSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Activate the corresponding role tab
    const targetTab = document.querySelector(`.${tabType}[data-role="${roleValue}"]`);
    if (targetTab) {
      // Simulate a click on the tab
      targetTab.click();
    }
  };
  
  // Testimonial Slider Functionality
  const testimonialSlider = {
    slides: document.querySelector('.testimonial-slides'),
    prevBtn: document.querySelector('.prev-btn'),
    nextBtn: document.querySelector('.next-btn'),
    dots: document.querySelectorAll('.testimonial-dots .dot'),
    currentIndex: 0,
    slideCount: document.querySelectorAll('.testimonial-slide').length,
    
    init: function() {
      if (!this.slides || !this.prevBtn || !this.nextBtn) return;
      
      // Initial setup
      this.setSlidePosition();
      
      // Event listeners
      this.prevBtn.addEventListener('click', () => this.goToPrev());
      this.nextBtn.addEventListener('click', () => this.goToNext());
      
      // Dot navigation
      this.dots.forEach(dot => {
        dot.addEventListener('click', () => {
          const index = parseInt(dot.getAttribute('data-index'));
          this.goToSlide(index);
        });
      });
      
      // Optional: Auto-play
      this.startAutoPlay();
    },
    
    setSlidePosition: function() {
      this.slides.style.transform = `translateX(-${this.currentIndex * 100}%)`;
      this.updateDots();
    },
    
    updateDots: function() {
      this.dots.forEach((dot, i) => {
        if (i === this.currentIndex) {
          dot.classList.add('bg-purple-800');
          dot.classList.remove('bg-purple-300');
        } else {
          dot.classList.add('bg-purple-300');
          dot.classList.remove('bg-purple-800');
        }
      });
    },
    
    goToPrev: function() {
      this.currentIndex = (this.currentIndex - 1 + this.slideCount) % this.slideCount;
      this.setSlidePosition();
    },
    
    goToNext: function() {
      this.currentIndex = (this.currentIndex + 1) % this.slideCount;
      this.setSlidePosition();
    },
    
    goToSlide: function(index) {
      this.currentIndex = index;
      this.setSlidePosition();
    },
    
    startAutoPlay: function() {
      setInterval(() => {
        this.goToNext();
      }, 5000); // Change slide every 5 seconds
    }
  };
  
  // Initialize the testimonial slider
  testimonialSlider.init();

  // Mobile menu toggle
  const mobileMenuBtn = document.querySelector('header button.md\\:hidden');
  const mobileMenu = document.querySelector('.hidden.bg-purple-900.w-full');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
});
