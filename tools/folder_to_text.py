import os
import tkinter as tk
from tkinter import filedialog

def browse_folder():
    folder_path = filedialog.askdirectory()
    folder_entry.delete(0, tk.END)
    folder_entry.insert(0, folder_path)

def write_to_text():
    folder_path = folder_entry.get()
    output_file_path = os.path.join(folder_path, "output.txt")
    # Directorios a excluir
    exclude_dirs = {"vendor", "node_modules", ".git"}
    
    # Se abre el archivo de salida especificando encoding="utf-8"
    with open(output_file_path, "w", encoding="utf-8") as output_file:
        for root, dirs, files in os.walk(folder_path):
            # Se filtra la lista de directorios para excluir los definidos en exclude_dirs
            dirs[:] = [d for d in dirs if d not in exclude_dirs]
            for file in files:
                file_path = os.path.join(root, file)
                output_file.write(f"Folder: {root}\n")
                output_file.write(f"File: {file}\n")
                try:
                    with open(file_path, "r", errors="replace") as f:
                        content = f.read()
                        output_file.write("Content:\n")
                        output_file.write(content)
                        output_file.write("\n---\n")
                except Exception as e:
                    # Se notifica en el archivo en caso de error al leer el archivo
                    output_file.write("Could not read file\n---\n")
    print(f"Output written to {output_file_path}")

# Configuración de la GUI
root = tk.Tk()
root.title("Folder to Text")

folder_label = tk.Label(root, text="Folder Path:")
folder_label.pack()

folder_entry = tk.Entry(root, width=50)
folder_entry.pack()

browse_button = tk.Button(root, text="Browse", command=browse_folder)
browse_button.pack()

convert_button = tk.Button(root, text="Convert to Text", command=write_to_text)
convert_button.pack()

root.mainloop()
