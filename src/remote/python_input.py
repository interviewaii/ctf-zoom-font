import sys
import json
import ctypes

# Load user32.dll for mouse and keyboard simulation
user32 = ctypes.windll.user32

def simulate_mouse_move(x, y):
    """Move mouse to absolute screen coordinates"""
    # Get screen dimensions
    screen_width = user32.GetSystemMetrics(0)
    screen_height = user32.GetSystemMetrics(1)
    
    # Convert normalized coordinates to screen coordinates
    screen_x = int(x * screen_width)
    screen_y = int(y * screen_height)
    
    # Move cursor
    user32.SetCursorPos(screen_x, screen_y)

def simulate_mouse_click(button, down):
    """Simulate mouse button press or release"""
    event_map = {
        ('left', True): 0x0002,   # MOUSEEVENTF_LEFTDOWN
        ('left', False): 0x0004,  # MOUSEEVENTF_LEFTUP
        ('right', True): 0x0008,  # MOUSEEVENTF_RIGHTDOWN
        ('right', False): 0x0010, # MOUSEEVENTF_RIGHTUP
        ('middle', True): 0x0020, # MOUSEEVENTF_MIDDLEDOWN
        ('middle', False): 0x0040 # MOUSEEVENTF_MIDDLEUP
    }
    
    event = event_map.get((button, down), event_map[('left', down)])
    user32.mouse_event(event, 0, 0, 0, 0)

def simulate_key(key):
    """Simulate keyboard key press"""
    # Map common keys to virtual key codes
    key_map = {
        'Enter': 0x0D,
        'Backspace': 0x08,
        'Tab': 0x09,
        'Escape': 0x1B,
        'Delete': 0x2E,
        'ArrowUp': 0x26,
        'ArrowDown': 0x28,
        'ArrowLeft': 0x25,
        'ArrowRight': 0x27,
        ' ': 0x20
    }
    
    if key in key_map:
        vk = key_map[key]
    elif len(key) == 1:
        # Convert single character to virtual key code
        vk = user32.VkKeyScanW(ord(key)) & 0xFF
    else:
        return
    
    # Press and release key
    user32.keybd_event(vk, 0, 0, 0)  # Key down
    user32.keybd_event(vk, 0, 2, 0)  # Key up

if __name__ == '__main__':
    # Read event from command line argument (base64 encoded)
    if len(sys.argv) < 2:
        sys.exit(1)
    
    import base64
    base64_json = sys.argv[1]
    event_json = base64.b64decode(base64_json).decode('utf-8')
    event = json.loads(event_json)
    
    event_type = event.get('type')
    
    if event_type == 'mousemove':
        simulate_mouse_move(event['x'], event['y'])
    elif event_type in ['mousedown', 'mouseup']:
        button = event.get('button', 'left')
        down = event_type == 'mousedown'
        simulate_mouse_click(button, down)
    elif event_type in ['keypress', 'keydown']:
        simulate_key(event['key'])
