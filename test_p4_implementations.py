#!/usr/bin/env python3
"""
Comprehensive validation script for P4-1, P4-2, P3-2 implementations.
Tests custom exceptions, validates imports, and verifies integration.

Run: python3 test_p4_implementations.py
"""

import sys
import os
import json
from pathlib import Path
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")

def print_pass(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_fail(text):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_info(text):
    print(f"{Colors.YELLOW}ℹ️  {text}{Colors.END}")

def test_p3_2_custom_exceptions():
    """Test P3-2: Custom exception handlers"""
    print_header("P3-2: Custom Exception Handlers")
    
    passed = 0
    failed = 0
    
    try:
        # Test imports
        from exceptions_custom import (
            ChorizaurioException,
            AuthenticationException,
            AuthorizationException,
            ValidationException,
            ResourceNotFoundException,
            ConflictException,
            DatabaseException,
            IntegrityException,
            ExternalServiceException,
            TimeoutException,
            InvalidStateException,
            DuplicateException,
            RateLimitException,
            FileException,
            ConfigurationException,
            to_http_exception
        )
        print_pass("All 13 custom exception types imported successfully")
        passed += 1
    except ImportError as e:
        print_fail(f"Failed to import exceptions: {e}")
        failed += 1
        return passed, failed
    
    # Test exception instantiation
    tests = [
        ("ChorizaurioException", ChorizaurioException("test error", 500)),
        ("AuthenticationException", AuthenticationException("auth failed")),
        ("AuthorizationException", AuthorizationException("no permissions")),
        ("ValidationException", ValidationException("invalid field", "email")),
        ("ResourceNotFoundException", ResourceNotFoundException("User", "123")),
        ("ConflictException", ConflictException("resource conflict")),
        ("DatabaseException", DatabaseException("db error", "query")),
        ("IntegrityException", IntegrityException("constraint violated")),
        ("ExternalServiceException", ExternalServiceException("Payment API", "timeout")),
        ("TimeoutException", TimeoutException("API call")),
        ("InvalidStateException", InvalidStateException("pending", "cannot submit")),
        ("DuplicateException", DuplicateException("user already exists")),
        ("RateLimitException", RateLimitException("too many requests")),
        ("FileException", FileException("not found", "read")),
        ("ConfigurationException", ConfigurationException("invalid config")),
    ]
    
    for exc_name, exc_instance in tests:
        try:
            assert hasattr(exc_instance, 'message'), f"{exc_name} missing message"
            assert hasattr(exc_instance, 'status_code'), f"{exc_name} missing status_code"
            assert hasattr(exc_instance, 'detail'), f"{exc_name} missing detail"
            assert exc_instance.status_code > 0, f"{exc_name} invalid status code"
            print_pass(f"{exc_name} created with status {exc_instance.status_code}")
            passed += 1
        except AssertionError as e:
            print_fail(f"{exc_name}: {e}")
            failed += 1
    
    # Test HTTP exception conversion
    try:
        exc = ValidationException("test", "field")
        http_exc = to_http_exception(exc)
        assert isinstance(http_exc, dict), "to_http_exception should return dict"
        assert 'status_code' in http_exc, "Missing status_code in HTTP exception"
        assert 'detail' in http_exc, "Missing detail in HTTP exception"
        print_pass(f"Exception conversion works: {json.dumps(http_exc, indent=2)}")
        passed += 1
    except Exception as e:
        print_fail(f"Exception conversion failed: {e}")
        failed += 1
    
    return passed, failed

def test_p4_2_zod_schemas():
    """Test P4-2: Zod validation schemas (frontend)"""
    print_header("P4-2: Zod Validation Schemas")
    
    passed = 0
    failed = 0
    
    try:
        # Check if schemas file exists
        schema_file = Path('frontend/src/utils/schemas.js')
        if schema_file.exists():
            print_pass(f"Zod schemas file exists: {schema_file}")
            passed += 1
            
            # Read and verify content
            content = schema_file.read_text()
            required_schemas = [
                'ProductoSchema',
                'ClienteSchema',
                'PedidoSchema',
                'UsuarioSchema',
                'ReporteSchema',
                'TemplateSchema',
                'OfertaSchema',
                'ListaPreciosSchema',
                'CategoriaSchema',
                'HojaRutaSchema',
                'OfflineQueueSchema',
                'AuthResponseSchema'
            ]
            
            missing = []
            for schema in required_schemas:
                if schema in content:
                    print_pass(f"Schema found: {schema}")
                    passed += 1
                else:
                    print_fail(f"Schema missing: {schema}")
                    missing.append(schema)
                    failed += 1
            
            if missing:
                print_fail(f"Missing schemas: {', '.join(missing)}")
            else:
                print_pass("All 12 required schemas present")
                passed += 1
                
        else:
            print_fail(f"Zod schemas file not found: {schema_file}")
            failed += 1
            
    except Exception as e:
        print_fail(f"Error checking Zod schemas: {e}")
        failed += 1
    
    return passed, failed

def test_p4_1_react_query():
    """Test P4-1: React Query configuration (frontend)"""
    print_header("P4-1: React Query Caching")
    
    passed = 0
    failed = 0
    
    try:
        # Check if queryClient file exists
        query_file = Path('frontend/src/utils/queryClient.js')
        if query_file.exists():
            print_pass(f"React Query client file exists: {query_file}")
            passed += 1
            
            # Read and verify content
            content = query_file.read_text()
            
            # Check for required components
            checks = [
                ('QueryClient instantiation', 'new QueryClient('),
                ('staleTime config', 'staleTime: 1000 * 60 * 5'),
                ('gcTime config', 'gcTime: 1000 * 60 * 10'),
                ('retry config', 'retry: 1'),
                ('retryDelay config', 'retryDelay'),
                ('ReactQueryProvider export', 'function ReactQueryProvider'),
                ('QueryClientProvider wrapper', 'QueryClientProvider'),
                ('Cache keys constant', 'CACHE_KEYS'),
            ]
            
            for check_name, check_text in checks:
                if check_text in content:
                    print_pass(f"Configuration found: {check_name}")
                    passed += 1
                else:
                    print_fail(f"Configuration missing: {check_name}")
                    failed += 1
                    
        else:
            print_fail(f"React Query client file not found: {query_file}")
            failed += 1
            
    except Exception as e:
        print_fail(f"Error checking React Query config: {e}")
        failed += 1
    
    return passed, failed

def test_main_integration():
    """Test backend main.py integration"""
    print_header("Backend Integration")
    
    passed = 0
    failed = 0
    
    try:
        # Check main.py for exception handler
        main_file = Path('backend/main.py')
        if main_file.exists():
            content = main_file.read_text()
            
            if 'from exceptions_custom import' in content:
                print_pass("Custom exceptions imported in main.py")
                passed += 1
            else:
                print_fail("Custom exceptions not imported in main.py")
                failed += 1
            
            if 'ChorizaurioException' in content:
                print_pass("ChorizaurioException referenced in main.py")
                passed += 1
            else:
                print_fail("ChorizaurioException not referenced in main.py")
                failed += 1
                
            if '@app.exception_handler(ChorizaurioException)' in content:
                print_pass("Exception handler middleware registered")
                passed += 1
            else:
                print_fail("Exception handler middleware not registered")
                failed += 1
                
        else:
            print_fail(f"main.py not found: {main_file}")
            failed += 1
            
    except Exception as e:
        print_fail(f"Error checking integration: {e}")
        failed += 1
    
    return passed, failed

def test_dependencies():
    """Test that required dependencies are installed"""
    print_header("Dependency Verification")
    
    passed = 0
    failed = 0
    
    try:
        # Check frontend dependencies
        package_json = Path('frontend/package.json')
        if package_json.exists():
            content = json.loads(package_json.read_text())
            deps = content.get('dependencies', {})
            devDeps = content.get('devDependencies', {})
            all_deps = {**deps, **devDeps}
            
            required = [
                ('@tanstack/react-query', 'React Query for caching'),
                ('zod', 'Zod for validation'),
            ]
            
            for dep_name, dep_desc in required:
                if dep_name in all_deps:
                    print_pass(f"{dep_desc}: {dep_name}@{all_deps[dep_name]}")
                    passed += 1
                else:
                    print_fail(f"{dep_desc} not found: {dep_name}")
                    failed += 1
        else:
            print_fail("package.json not found")
            failed += 1
            
    except Exception as e:
        print_fail(f"Error checking dependencies: {e}")
        failed += 1
    
    return passed, failed

def generate_summary(results):
    """Generate test summary"""
    print_header("Test Summary")
    
    total_passed = sum(r[1][0] for r in results)
    total_failed = sum(r[1][1] for r in results)
    total_tests = total_passed + total_failed
    pass_rate = (total_passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Total Tests: {total_tests}")
    print_pass(f"Passed: {total_passed}")
    if total_failed > 0:
        print_fail(f"Failed: {total_failed}")
    print(f"Pass Rate: {pass_rate:.1f}%\n")
    
    status = Colors.GREEN + "✅ ALL TESTS PASSED" + Colors.END if total_failed == 0 else Colors.RED + "❌ SOME TESTS FAILED" + Colors.END
    print(f"Status: {status}\n")
    
    return total_failed == 0

def main():
    """Run all tests"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}🚀 P4-1, P4-2, P3-2 Implementation Validation{Colors.END}")
    print(f"{Colors.YELLOW}Timestamp: {datetime.now().isoformat()}{Colors.END}\n")
    
    results = [
        ("P3-2 Custom Exceptions", test_p3_2_custom_exceptions()),
        ("P4-2 Zod Schemas", test_p4_2_zod_schemas()),
        ("P4-1 React Query", test_p4_1_react_query()),
        ("Backend Integration", test_main_integration()),
        ("Dependencies", test_dependencies()),
    ]
    
    success = generate_summary(results)
    
    # Detailed results table
    print(f"{Colors.BOLD}Detailed Results:{Colors.END}")
    for test_name, (passed, failed) in results:
        total = passed + failed
        rate = (passed / total * 100) if total > 0 else 0
        status = Colors.GREEN + "PASS" + Colors.END if failed == 0 else Colors.RED + "FAIL" + Colors.END
        print(f"  {test_name:30} {passed:3}/{total:3} ({rate:5.1f}%) {status}")
    
    return 0 if success else 1

if __name__ == '__main__':
    sys.exit(main())
