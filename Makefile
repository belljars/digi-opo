.PHONY: run build check

run:
	./run_linux.sh

build:
	npm run build

check:
	npm run check
	python3 -c "import webview; print('python backend imports: OK')"
