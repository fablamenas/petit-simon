import sys
import os

# Set the path to the project directory
project_dir = '/home/fabien/Antigravity/projects/petit-simon'
sys.path.insert(0, project_dir)

from server import app as application
