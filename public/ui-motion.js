import { animate } from "https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm";

/**
 * Spring-Loaded Modals
 */
export function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const card = modal.querySelector('.modal-card');
  
  if (show) {
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    animate(modal, { opacity: [0, 1] }, { duration: 0.2 });
    animate(card, 
      { opacity: [0, 1], scale: [0.85, 1], y: [20, 0] }, 
      { type: "spring", stiffness: 350, damping: 25 }
    );
  } else {
    animate(modal, { opacity: [1, 0] }, { duration: 0.2 });
    animate(card, { opacity: [1, 0], scale: [1, 0.95], y: [0, 10] }, { duration: 0.2 })
      .finished.then(() => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      });
  }
}

/**
 * Fluid Sidebar Drawer
 */
export function toggleSidebar(show) {
  const sidebar = document.getElementById('chatSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (show) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'block';
    animate(overlay, { opacity: [0, 1] }, { duration: 0.2 });
    animate(sidebar, { x: ["-100%", "0%"] }, { type: "spring", stiffness: 300, damping: 30 });
  } else {
    animate(overlay, { opacity: [1, 0] }, { duration: 0.2 }).finished.then(() => {
      overlay.classList.add('hidden');
      overlay.style.display = 'none';
    });
    animate(sidebar, { x: ["0%", "-100%"] }, { type: "spring", stiffness: 300, damping: 30 });
  }
}

/**
 * Liquid Glass Context Menu 
 */
export function openContextMenu(menuId, x, y) {
  const menu = document.getElementById(menuId);
  const card = document.getElementById('msgContextMenuCard');
  
  menu.classList.remove('hidden');
  menu.style.display = 'block';
  
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);
  
  card.style.left = `${adjustedX}px`;
  card.style.top = `${adjustedY}px`;

  animate(menu, { opacity: [0, 1] }, { duration: 0.15 });
  animate(card, 
    { opacity: [0, 1], scale: [0.6, 1], filter: ["blur(10px)", "blur(0px)"] }, 
    { type: "spring", stiffness: 450, damping: 25 }
  );
}

export function closeContextMenu(menuId) {
  const menu = document.getElementById(menuId);
  const card = document.getElementById('msgContextMenuCard');
  if(!menu) return;
  
  animate(menu, { opacity: [1, 0] }, { duration: 0.15 });
  animate(card, { opacity: [1, 0], scale: [1, 0.8] }, { duration: 0.15 })
    .finished.then(() => {
      menu.classList.add('hidden');
      menu.style.display = 'none';
    });
}

/**
 * Animated Message Feed (Pop-in)
 */
export function animateNewMessage(messageElement) {
  animate(messageElement, 
    { opacity: [0, 1], y: [20, 0], scale: [0.95, 1] }, 
    { type: "spring", stiffness: 400, damping: 25 }
  );
}

/**
 * Mobile Swipe-to-Reply Gesture
 */
export function attachSwipeToReply(msgBubble, onReplyTriggered) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  const threshold = 55;

  const replyIcon = document.createElement('div');
  replyIcon.innerHTML = '↩️';
  replyIcon.className = 'swipe-reply-icon';
  msgBubble.style.position = 'relative';
  msgBubble.insertBefore(replyIcon, msgBubble.firstChild);

  msgBubble.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    isDragging = true;
    startX = e.clientX;
    msgBubble.setPointerCapture(e.pointerId);
  });

  msgBubble.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    
    // Only allow swipe right
    if (currentX > 0 && currentX < 90) {
      animate(msgBubble, { x: currentX }, { duration: 0 });
      const progress = Math.min(currentX / threshold, 1);
      animate(replyIcon, { scale: progress, opacity: progress }, { duration: 0 });
    }
  });

  msgBubble.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    if (currentX >= threshold) {
      if (navigator.vibrate) navigator.vibrate(40);
      onReplyTriggered();
    }
    
    animate(msgBubble, { x: 0 }, { type: "spring", stiffness: 500, damping: 25 });
    animate(replyIcon, { scale: 0, opacity: 0 }, { duration: 0.2 });
    currentX = 0;
    msgBubble.releasePointerCapture(e.pointerId);
  });
}