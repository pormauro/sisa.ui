import os
import sys

def process_folder(folder_path):
    output_file_path = os.path.join(folder_path, "output.txt")
    # Directorios a excluir
    exclude_dirs = {"vendor", "node_modules", ".git"}
    
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
                    output_file.write("Could not read file\n---\n")
    print(f"Output written to {output_file_path}")

def main():
    # Directorio donde se encuentra este script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Carpetas a procesar
    folders = ["sisa.ui/app", "sisa.api"]
    
    for folder in folders:
        folder_path = os.path.join(script_dir, folder)
        if os.path.isdir(folder_path):
            process_folder(folder_path)
        else:
            print(f"Folder '{folder}' not found in {script_dir}")
    
    # Finalizado el proceso para ambas carpetas, se cierra el programa
    sys.exit(0)

if __name__ == "__main__":
    main()
